# Customer Support Chatbot

## Overview
The **Customer Support Chatbot** is an AI-powered chatbot designed to handle customer inquiries using **Advanced Natural Language Processing (NLP) and Machine Learning**. Built with **Flask/Django**, the chatbot utilizes **Hugging Face Transformers**, **TensorFlow/PyTorch**, and a **PostgreSQL/MySQL database** to provide accurate and context-aware responses. The chatbot can classify intents, extract named entities, perform sentiment analysis, and continuously learn from user feedback.

---

## Features

### 1. **Intent Detection**
- Uses **BERT-based models** to classify user queries.
- Identifies customer issues (e.g., order tracking, refunds, complaints).

### 2. **Named Entity Recognition (NER)**
- Extracts key information like **order ID, date, product names**.
- Improves chatbot accuracy by using structured data.

### 3. **Sentiment Analysis**
- Detects **user frustration levels**.
- Escalates urgent issues to human support if necessary.

### 4. **Context-Aware Responses (RAG - Retrieval-Augmented Generation)**
- Retrieves past conversations and knowledge base articles.
- Uses **GPT-like models** for dynamic responses.

### 5. **Continuous Learning**
- Stores user feedback and conversation history.
- Improves responses by periodically fine-tuning models.

### 6. **Database Storage**
- Uses **PostgreSQL/MySQL** to store conversation history, intents, and training data.

### 7. **API-Based Deployment**
- Provides REST API endpoints to integrate with web and mobile apps.
- Deployable on **Render, Railway, Hugging Face Spaces**.

---

## Tech Stack

| Component  | Technology |
|------------|-----------|
| **Backend** | Flask / Django |
| **NLP Models** | Hugging Face Transformers (BERT, DistilBERT) |
| **Machine Learning** | TensorFlow / PyTorch |
| **Database** | PostgreSQL / MySQL |
| **Deployment** | Render / Railway / Hugging Face Spaces |
| **Frontend (Optional)** | React / Vue.js (for chat UI) |

---

## Database Schema

### 1. **Intents Table (`intents`)**
Stores predefined chatbot intents.
```sql
id | name          | created_at  | updated_at
--------------------------------------------
1  | Order Status | 2025-02-08  | 2025-02-08
2  | Refund Issue | 2025-02-08  | 2025-02-08
```

### 2. **Training Data Table (`training_data`)**
Stores training phrases for machine learning models.
```sql
id | intent_id | user_input          | bot_response      | created_at
--------------------------------------------------------------
1  | 1         | "Where is my order?" | "Checking status" | 2025-02-08
2  | 2         | "I want a refund"    | "Refund policy"   | 2025-02-08
```

### 3. **Conversations Table (`conversations`)**
Stores chatbot sessions.
```sql
id | user_id | status  | created_at
----------------------------------
1  | 23      | Open    | 2025-02-08
```

### 4. **Messages Table (`messages`)**
Stores all chat messages.
```sql
id | conversation_id | sender_id | message_text     | is_bot | timestamp
------------------------------------------------------------------------
1  | 1              | 23        | "Where is my order?" | 0  | 2025-02-08
2  | 1              | NULL      | "Checking status"   | 1  | 2025-02-08
```

### 5. **Feedback Table (`feedback`)**
Stores user feedback to improve the chatbot.
```sql
id | user_id | conversation_id | rating | comment        | created_at
----------------------------------------------------------------------
1  | 23      | 1              | 3      | "Not helpful"  | 2025-02-08
```

---

## Installation

### 1. **Clone the Repository**
```bash
git clone https://github.com/your-repo/customer-support-chatbot.git
cd customer-support-chatbot
```

### 2. **Create Virtual Environment**
```bash
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate  # Windows
```

### 3. **Install Dependencies**
```bash
pip install -r requirements.txt
```

### 4. **Set Up Environment Variables**
Create a `.env` file and add:
```env
DATABASE_URL=postgresql://user:password@localhost/chatbot_db
SECRET_KEY=your_secret_key
HUGGINGFACE_API_KEY=your_api_key
```

### 5. **Run Migrations**
```bash
flask db upgrade  # Flask
python manage.py migrate  # Django
```

### 6. **Start the Server**
```bash
flask run  # Flask
python manage.py runserver  # Django
```

---

## API Endpoints

### **1. Chatbot API**
- **POST** `/api/chat`
```json
{
  "user_id": 23,
  "message": "Where is my order?"
}
```
- **Response:**
```json
{
  "response": "Checking status...",
  "intent": "Order Status"
}
```

### **2. Training API**
- **POST** `/api/train`
```json
{
  "intent": "Refund Issue",
  "training_phrases": ["I want a refund", "How do I get my money back?"]
}
```

### **3. Feedback API**
- **POST** `/api/feedback`
```json
{
  "user_id": 23,
  "conversation_id": 1,
  "rating": 5,
  "comment": "Great chatbot!"
}
```

---

## Deployment

### **1. Deploy to Render**
- Create a **Flask/Django** service on [Render](https://render.com/).
- Add environment variables.
- Deploy using `gunicorn`.

### **2. Deploy NLP Model on Hugging Face Spaces**
- Use **Gradio or FastAPI** to serve the model.
- Upload the fine-tuned model to **Hugging Face Hub**.

### **3. CI/CD (GitHub Actions)**
- Automate deployment when pushing new code.

---

## Future Enhancements
- Implement **voice-based support**.
- Integrate with **WhatsApp & Telegram**.
- Improve **context retention** for better conversations.

---

## Contributors
- **Benjamin Baya** - Developer & Maintainer

---

## License
MIT License

---

## Support
For issues or feature requests, open a GitHub issue or email **b3njaminbaya@gmail.com**.

