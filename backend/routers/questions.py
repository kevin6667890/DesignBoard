from fastapi import APIRouter

router = APIRouter()

QUESTIONS = [
    # Easy
    {
        "id": "url-shortener",
        "title": "URL Shortener",
        "difficulty": "Easy",
        "description": "Design a service like TinyURL. Handle millions of redirects per day."
    },
    {
        "id": "parking-lot",
        "title": "Parking Lot System",
        "difficulty": "Easy",
        "description": "Design software for a multi-floor parking garage with real-time availability."
    },
    {
        "id": "rate-limiter",
        "title": "Rate Limiter",
        "difficulty": "Easy",
        "description": "Design a rate limiter that can be used as middleware across microservices."
    },
    {
        "id": "key-value-store",
        "title": "Key-Value Store",
        "difficulty": "Easy",
        "description": "Design an in-memory key-value store like Redis."
    },
    {
        "id": "task-scheduler",
        "title": "Task Scheduler",
        "difficulty": "Easy",
        "description": "Design a system that runs scheduled jobs at specified intervals."
    },
    # Medium
    {
        "id": "twitter-feed",
        "title": "Twitter / X Feed",
        "difficulty": "Medium",
        "description": "Design the home timeline feed for 300M daily active users."
    },
    {
        "id": "whatsapp",
        "title": "WhatsApp Messaging",
        "difficulty": "Medium",
        "description": "Design end-to-end encrypted messaging with online presence."
    },
    {
        "id": "youtube",
        "title": "YouTube",
        "difficulty": "Medium",
        "description": "Design video upload, processing, and streaming at scale."
    },
    {
        "id": "uber",
        "title": "Uber / Ride Sharing",
        "difficulty": "Medium",
        "description": "Design real-time driver matching and trip management."
    },
    {
        "id": "instagram",
        "title": "Instagram",
        "difficulty": "Medium",
        "description": "Design photo upload, feed generation, and story expiry."
    },
    {
        "id": "notification-system",
        "title": "Notification System",
        "difficulty": "Medium",
        "description": "Design a system that sends push, email, and SMS notifications at scale."
    },
    {
        "id": "autocomplete",
        "title": "Search Autocomplete",
        "difficulty": "Medium",
        "description": "Design a typeahead search suggestion system like Google's."
    },
    # Hard
    {
        "id": "web-crawler",
        "title": "Google Web Crawler",
        "difficulty": "Hard",
        "description": "Design a distributed crawler that indexes the entire web."
    },
    {
        "id": "netflix",
        "title": "Netflix Streaming",
        "difficulty": "Hard",
        "description": "Design video delivery infrastructure for 200M subscribers globally."
    },
    {
        "id": "message-queue",
        "title": "Distributed Message Queue",
        "difficulty": "Hard",
        "description": "Design a durable, ordered message queue like Kafka."
    },
    {
        "id": "stock-exchange",
        "title": "Stock Exchange",
        "difficulty": "Hard",
        "description": "Design a matching engine for a high-frequency trading platform."
    },
    {
        "id": "cdn",
        "title": "Global CDN",
        "difficulty": "Hard",
        "description": "Design a content delivery network with edge caching and failover."
    }
]

DIFFICULTY_MAP = {q["id"]: q["difficulty"] for q in QUESTIONS}
TITLE_MAP = {q["id"]: q["title"] for q in QUESTIONS}


@router.get("/questions")
def get_questions():
    return QUESTIONS
