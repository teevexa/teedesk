#!/usr/bin/env python3
"""
Seed the database with a default tenant, users, intents, and knowledge articles.
Run from services/api/ with:
    python -m scripts.seed
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.intent import Intent
from app.models.knowledge import KnowledgeArticle
from app.models.tenant import Tenant
from app.models.user import User

_DEFAULT_TENANT_SLUG = "acme-corp"

SEED_INTENTS = [
    {
        "name": "greeting",
        "description": "User is greeting the assistant",
        "examples": ["hello", "hi there", "hey", "good morning", "howdy"],
        "response_template": "Hello! How can I help you today?",
        "confidence_threshold": 0.6,
    },
    {
        "name": "billing_inquiry",
        "description": "User asking about billing, invoices, or payments",
        "examples": [
            "I have a question about my bill",
            "When is my next payment due?",
            "I was charged incorrectly",
            "Can I get an invoice?",
        ],
        "response_template": "I'd be happy to help with your billing question. Let me look into that for you.",
        "confidence_threshold": 0.7,
    },
    {
        "name": "technical_support",
        "description": "User reporting a technical issue or bug",
        "examples": [
            "The app is not working",
            "I'm getting an error",
            "Something broke",
            "I can't log in",
        ],
        "response_template": "I'm sorry to hear you're experiencing a technical issue. Let me help you troubleshoot.",
        "confidence_threshold": 0.7,
    },
    {
        "name": "cancellation",
        "description": "User wants to cancel their subscription or account",
        "examples": [
            "I want to cancel my subscription",
            "How do I cancel?",
            "I want to close my account",
        ],
        "response_template": "I understand you'd like to cancel. Let me connect you with our retention team.",
        "confidence_threshold": 0.75,
    },
    {
        "name": "farewell",
        "description": "User is ending the conversation",
        "examples": ["bye", "goodbye", "thanks, that's all", "see you later"],
        "response_template": "Thank you for reaching out! Have a great day.",
        "confidence_threshold": 0.6,
    },
]

SEED_ARTICLES = [
    {
        "title": "How to reset your password",
        "content": (
            "To reset your password:\n"
            "1. Go to the login page and click 'Forgot Password'.\n"
            "2. Enter your email address.\n"
            "3. Check your inbox for a reset link (check spam if not received).\n"
            "4. Click the link and enter your new password.\n"
            "5. Log in with your new credentials.\n\n"
            "If you do not receive the email within 5 minutes, contact support."
        ),
        "category": "account",
        "tags": ["password", "login", "account"],
    },
    {
        "title": "Understanding your monthly invoice",
        "content": (
            "Your monthly invoice includes:\n"
            "- Base subscription fee based on your plan tier.\n"
            "- Usage charges for API calls exceeding your plan quota.\n"
            "- Any add-on features activated during the billing period.\n\n"
            "Invoices are generated on the 1st of each month and are due within 14 days. "
            "You can download past invoices from the Billing section of your dashboard."
        ),
        "category": "billing",
        "tags": ["billing", "invoice", "payment"],
    },
    {
        "title": "Getting started with TeeDesk",
        "content": (
            "Welcome to TeeDesk! Here's how to get started:\n\n"
            "1. **Create your tenant account** — Sign up and verify your email.\n"
            "2. **Configure your knowledge base** — Upload FAQs and help docs.\n"
            "3. **Set up intents** — Define the types of questions your AI will handle.\n"
            "4. **Install the chat widget** — Add our JavaScript snippet to your website.\n"
            "5. **Test your bot** — Use the playground to simulate conversations.\n\n"
            "For detailed setup instructions, see our documentation at docs.teedesk.io."
        ),
        "category": "getting-started",
        "tags": ["setup", "onboarding", "getting-started"],
    },
    {
        "title": "How to escalate a conversation to a human agent",
        "content": (
            "Conversations are automatically escalated when:\n"
            "- The AI confidence score drops below the threshold.\n"
            "- The user's sentiment score is persistently negative.\n"
            "- The user explicitly requests a human agent.\n\n"
            "To manually escalate: type 'talk to a human' or 'I want to speak with someone'.\n\n"
            "Agents receive notifications in the admin dashboard and can pick up the conversation."
        ),
        "category": "escalation",
        "tags": ["escalation", "human-handoff", "agent"],
    },
]


async def seed() -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # Idempotency check — skip if tenant already exists
        existing = (
            await session.execute(
                text("SELECT id FROM tenants WHERE slug = :slug"),
                {"slug": _DEFAULT_TENANT_SLUG},
            )
        ).fetchone()

        if existing:
            print(f"Seed already applied (tenant '{_DEFAULT_TENANT_SLUG}' exists). Skipping.")
            return

        print("Seeding database...")

        # Tenant
        tenant = Tenant(name="Acme Corp", slug=_DEFAULT_TENANT_SLUG, plan="starter")
        session.add(tenant)
        await session.flush()
        print(f"  Created tenant: {tenant.slug} ({tenant.id})")

        # Admin user
        admin = User(
            tenant_id=tenant.id,
            email="admin@acme-corp.example",
            name="Admin User",
            role="admin",
        )
        session.add(admin)

        # Agent user
        agent = User(
            tenant_id=tenant.id,
            email="agent@acme-corp.example",
            name="Support Agent",
            role="agent",
        )
        session.add(agent)
        await session.flush()
        print(f"  Created users: {admin.email}, {agent.email}")

        # Intents
        for intent_data in SEED_INTENTS:
            intent = Intent(tenant_id=tenant.id, **intent_data)
            session.add(intent)
        await session.flush()
        print(f"  Created {len(SEED_INTENTS)} intents")

        # Knowledge articles
        for article_data in SEED_ARTICLES:
            article = KnowledgeArticle(
                tenant_id=tenant.id,
                author_id=admin.id,
                **article_data,
            )
            session.add(article)
        await session.flush()
        print(f"  Created {len(SEED_ARTICLES)} knowledge articles")

        await session.commit()
        print("Seed complete.")
        print(f"\nDefault tenant slug: {_DEFAULT_TENANT_SLUG}")
        print(f"Admin email:         admin@acme-corp.example")
        print(f"Agent email:         agent@acme-corp.example")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
