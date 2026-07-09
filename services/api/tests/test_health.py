import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_root(client: AsyncClient) -> None:
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "SupportIQ API"
    assert "docs" in data


@pytest.mark.asyncio
async def test_health(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ok", "degraded")
    assert "services" in data
    assert "database" in data["services"]


@pytest.mark.asyncio
async def test_docs_available(client: AsyncClient) -> None:
    response = await client.get("/docs")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_openapi_schema(client: AsyncClient) -> None:
    response = await client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "SupportIQ API"
    assert "/api/v1/conversations" in schema["paths"]
    assert "/api/v1/messages" in schema["paths"]
    assert "/api/v1/knowledge" in schema["paths"]
    assert "/api/v1/feedback" in schema["paths"]
    assert "/api/v1/intents" in schema["paths"]
