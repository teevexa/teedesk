# SupportIQ Inference Service

Manages local LLM inference using Ollama. Provides an OpenAI-compatible API at `http://localhost:11434`.

## Recommended Models

| Model | Size | Purpose |
|---|---|---|
| `mistral:7b-instruct` | 4.1 GB | Primary response generation |
| `llama3.1:8b` | 4.7 GB | Higher quality responses |
| `phi3:mini` | 2.3 GB | Low-resource fallback |
| `nomic-embed-text` | 274 MB | Text embeddings for RAG |

## Setup

### 1. Install Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Or use Docker (see docker-compose.yml)
docker compose up ollama
```

### 2. Pull Models

```bash
# Primary LLM
ollama pull mistral:7b-instruct

# Embedding model (required for RAG)
ollama pull nomic-embed-text
```

### 3. Verify

```bash
curl http://localhost:11434/api/tags
```

## System Prompt Template

The FastAPI backend sends structured prompts. Example:

```
You are SupportIQ, a helpful customer support AI assistant.
Use the following knowledge base context to answer the customer's question accurately.
If the context doesn't contain enough information, say so honestly and offer to escalate.

Context:
{retrieved_knowledge}

Customer message: {user_message}
Conversation history:
{conversation_history}

Respond in a helpful, professional, and empathetic tone.
```

## Modelfile (Custom System Prompt)

```bash
ollama create supportiq -f Modelfile
```
