"""
Kerala RAG — LLM Service
Supports Groq (primary) and HuggingFace Inference API (fallback).
Both are free-tier compatible. Includes streaming support.
"""
import httpx
import json
from typing import AsyncGenerator, List, Dict, Optional
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings

SYSTEM_PROMPT = """You are KeralaCompliance AI, an expert assistant specializing in Kerala (India) business regulations, licenses, permits, and compliance requirements.

You help entrepreneurs, businesses, and citizens understand:
- Licenses and permits required for various business types
- Step-by-step compliance procedures
- Government departments and their roles
- Forms to fill, fees to pay, and timelines
- Acts, rules, and regulations applicable in Kerala
- MSME registrations, factory licenses, trade licenses, FSSAI, Fire NOC, and more

Guidelines:
- Always base your answers on the provided context documents
- Cite the source document when making specific claims
- If a procedure has steps, present them clearly and in order
- Mention the relevant government department (e.g., Kerala Municipal Corporation, PCB, Fire & Rescue)
- If the context does not contain enough information, say so clearly and suggest the user consult the relevant authority
- Keep answers concise but complete
- Use plain language that non-experts can understand
- When listing licenses, mention estimated fees and timelines if available in context

You are helpful, accurate, and legally cautious. Do not give definitive legal advice — direct users to official sources for confirmation."""


class LLMService:
    def __init__(self):
        self.provider = settings.llm_provider

    # ------------------------------------------------------------------ #
    #  Prompt Builder                                                      #
    # ------------------------------------------------------------------ #

    def build_prompt(
        self,
        query: str,
        retrieved_chunks: List[Dict],
        chat_history: Optional[List[Dict]] = None,
    ) -> str:
        """
        Build the RAG prompt from query + retrieved context.
        Keeps token count low for free-tier models.
        """
        # Build context from chunks (limit to max_context_tokens)
        context_parts = []
        approx_tokens = 0
        max_tokens = settings.max_context_tokens

        for chunk in retrieved_chunks:
            text = chunk.get("text", "")
            source = chunk.get("source_file", "unknown")
            cat = chunk.get("category", "")
            page = chunk.get("page_number")

            citation = f"[{source}"
            if page:
                citation += f", p.{page}"
            citation += f" — {cat}]"

            snippet = f"{citation}\n{text}"
            snippet_tokens = len(snippet) // 4  # rough estimate

            if approx_tokens + snippet_tokens > max_tokens:
                break
            context_parts.append(snippet)
            approx_tokens += snippet_tokens

        context_str = "\n\n---\n\n".join(context_parts) if context_parts else "No relevant documents found."

        # Chat history (last 3 turns)
        history_str = ""
        if chat_history:
            for turn in chat_history[-3:]:
                role = turn.get("role", "user")
                content = turn.get("content", "")
                history_str += f"\n{role.upper()}: {content}"

        prompt = f"""CONTEXT DOCUMENTS:
{context_str}

{f'PREVIOUS CONVERSATION:{history_str}' if history_str else ''}

USER QUESTION: {query}

Please answer based on the context documents above. Cite sources where relevant."""

        return prompt

    # ------------------------------------------------------------------ #
    #  Groq                                                                #
    # ------------------------------------------------------------------ #

    async def chat_groq(
        self,
        prompt: str,
        stream: bool = True,
    ) -> AsyncGenerator[str, None]:
        """Call Groq API with streaming."""
        if not settings.groq_api_key:
            yield "Error: GROQ_API_KEY not configured."
            return

        headers = {
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.groq_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 1024,
            "temperature": 0.2,
            "stream": stream,
        }

        async with httpx.AsyncClient(timeout=60) as client:
            if stream:
                async with client.stream(
                    "POST",
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json=payload,
                ) as response:
                    if response.status_code != 200:
                        error = await response.aread()
                        logger.error(f"Groq error {response.status_code}: {error}")
                        yield f"Error from Groq API: {response.status_code}"
                        return
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data)
                                delta = chunk["choices"][0]["delta"].get("content", "")
                                if delta:
                                    yield delta
                            except Exception:
                                continue
            else:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json=payload,
                )
                resp.raise_for_status()
                yield resp.json()["choices"][0]["message"]["content"]

    # ------------------------------------------------------------------ #
    #  HuggingFace Inference API                                           #
    # ------------------------------------------------------------------ #

    async def chat_huggingface(
        self,
        prompt: str,
    ) -> AsyncGenerator[str, None]:
        """Call HuggingFace Inference API (non-streaming, free tier)."""
        if not settings.hf_api_key:
            yield "Error: HF_API_KEY not configured."
            return

        url = f"https://api-inference.huggingface.co/models/{settings.hf_model}"
        headers = {"Authorization": f"Bearer {settings.hf_api_key}"}
        full_prompt = f"<s>[INST] <<SYS>>\n{SYSTEM_PROMPT}\n<</SYS>>\n\n{prompt} [/INST]"

        payload = {
            "inputs": full_prompt,
            "parameters": {
                "max_new_tokens": 800,
                "temperature": 0.2,
                "return_full_text": False,
            },
        }

        async with httpx.AsyncClient(timeout=120) as client:
            try:
                resp = await client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                if isinstance(data, list) and data:
                    text = data[0].get("generated_text", "")
                    # Stream word by word for UX
                    words = text.split(" ")
                    for word in words:
                        yield word + " "
                else:
                    yield "No response from HuggingFace."
            except Exception as e:
                logger.error(f"HuggingFace error: {e}")
                yield f"Error calling HuggingFace: {str(e)}"

    # ------------------------------------------------------------------ #
    #  Unified Interface                                                   #
    # ------------------------------------------------------------------ #

    async def generate(
        self,
        query: str,
        retrieved_chunks: List[Dict],
        chat_history: Optional[List[Dict]] = None,
        stream: bool = True,
    ) -> AsyncGenerator[str, None]:
        """Main entry point. Routes to configured provider."""
        prompt = self.build_prompt(query, retrieved_chunks, chat_history)

        if self.provider == "groq":
            async for token in self.chat_groq(prompt, stream=stream):
                yield token
        elif self.provider == "huggingface":
            async for token in self.chat_huggingface(prompt):
                yield token
        else:
            yield "Error: Unknown LLM provider. Set LLM_PROVIDER=groq or huggingface."


# Singleton
llm_service = LLMService()
