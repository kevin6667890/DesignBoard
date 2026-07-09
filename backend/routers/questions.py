from fastapi import APIRouter

router = APIRouter()

QUESTIONS = [
    # Easy
    {
        "id": "url-shortener",
        "title": "URL Shortener",
        "title_zh": "短链接系统",
        "difficulty": "Easy",
        "description": "Design a service like TinyURL. Handle millions of redirects per day.",
        "description_zh": "设计一个类似 TinyURL 的服务，支持每天数百万次跳转。"
    },
    {
        "id": "parking-lot",
        "title": "Parking Lot System",
        "title_zh": "停车场系统",
        "difficulty": "Easy",
        "description": "Design software for a multi-floor parking garage with real-time availability.",
        "description_zh": "为多层停车场设计一套支持实时车位状态的软件系统。"
    },
    {
        "id": "rate-limiter",
        "title": "Rate Limiter",
        "title_zh": "限流系统",
        "difficulty": "Easy",
        "description": "Design a rate limiter that can be used as middleware across microservices.",
        "description_zh": "设计一个可作为微服务中间件使用的限流系统。"
    },
    {
        "id": "key-value-store",
        "title": "Key-Value Store",
        "title_zh": "键值存储系统",
        "difficulty": "Easy",
        "description": "Design an in-memory key-value store like Redis.",
        "description_zh": "设计一个类似 Redis 的内存键值存储系统。"
    },
    {
        "id": "task-scheduler",
        "title": "Task Scheduler",
        "title_zh": "任务调度系统",
        "difficulty": "Easy",
        "description": "Design a system that runs scheduled jobs at specified intervals.",
        "description_zh": "设计一个按指定间隔运行计划任务的系统。"
    },
    # Medium
    {
        "id": "twitter-feed",
        "title": "Twitter / X Feed",
        "title_zh": "Twitter / X 信息流",
        "difficulty": "Medium",
        "description": "Design the home timeline feed for 300M daily active users.",
        "description_zh": "为 3 亿日活用户设计首页时间线信息流。"
    },
    {
        "id": "whatsapp",
        "title": "WhatsApp Messaging",
        "title_zh": "WhatsApp 消息系统",
        "difficulty": "Medium",
        "description": "Design end-to-end encrypted messaging with online presence.",
        "description_zh": "设计支持在线状态的端到端加密消息系统。"
    },
    {
        "id": "youtube",
        "title": "YouTube",
        "title_zh": "YouTube 视频系统",
        "difficulty": "Medium",
        "description": "Design video upload, processing, and streaming at scale.",
        "description_zh": "设计大规模视频上传、处理和流媒体播放系统。"
    },
    {
        "id": "uber",
        "title": "Uber / Ride Sharing",
        "title_zh": "Uber / 网约车系统",
        "difficulty": "Medium",
        "description": "Design real-time driver matching and trip management.",
        "description_zh": "设计实时司机匹配和行程管理系统。"
    },
    {
        "id": "instagram",
        "title": "Instagram",
        "title_zh": "Instagram 图片社交系统",
        "difficulty": "Medium",
        "description": "Design photo upload, feed generation, and story expiry.",
        "description_zh": "设计图片上传、信息流生成和限时动态过期机制。"
    },
    {
        "id": "notification-system",
        "title": "Notification System",
        "title_zh": "通知系统",
        "difficulty": "Medium",
        "description": "Design a system that sends push, email, and SMS notifications at scale.",
        "description_zh": "设计一个可大规模发送推送、邮件和短信的通知系统。"
    },
    {
        "id": "autocomplete",
        "title": "Search Autocomplete",
        "title_zh": "搜索自动补全系统",
        "difficulty": "Medium",
        "description": "Design a typeahead search suggestion system like Google's.",
        "description_zh": "设计一个类似 Google 的搜索输入建议系统。"
    },
    # Hard
    {
        "id": "web-crawler",
        "title": "Google Web Crawler",
        "title_zh": "Google 网页爬虫系统",
        "difficulty": "Hard",
        "description": "Design a distributed crawler that indexes the entire web.",
        "description_zh": "设计一个可索引全网内容的分布式爬虫系统。"
    },
    {
        "id": "netflix",
        "title": "Netflix Streaming",
        "title_zh": "Netflix 流媒体系统",
        "difficulty": "Hard",
        "description": "Design video delivery infrastructure for 200M subscribers globally.",
        "description_zh": "为全球 2 亿订阅用户设计视频分发基础设施。"
    },
    {
        "id": "message-queue",
        "title": "Distributed Message Queue",
        "title_zh": "分布式消息队列",
        "difficulty": "Hard",
        "description": "Design a durable, ordered message queue like Kafka.",
        "description_zh": "设计一个类似 Kafka 的持久化有序消息队列。"
    },
    {
        "id": "stock-exchange",
        "title": "Stock Exchange",
        "title_zh": "证券交易所撮合系统",
        "difficulty": "Hard",
        "description": "Design a matching engine for a high-frequency trading platform.",
        "description_zh": "为高频交易平台设计撮合引擎。"
    },
    {
        "id": "cdn",
        "title": "Global CDN",
        "title_zh": "全球 CDN 系统",
        "difficulty": "Hard",
        "description": "Design a content delivery network with edge caching and failover.",
        "description_zh": "设计一个支持边缘缓存和故障切换的内容分发网络。"
    }
]

DIFFICULTY_MAP = {q["id"]: q["difficulty"] for q in QUESTIONS}
TITLE_MAP = {q["id"]: q["title"] for q in QUESTIONS}


@router.get("/questions")
def get_questions():
    return QUESTIONS
