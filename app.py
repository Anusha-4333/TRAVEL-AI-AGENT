from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv
import os
import json
import sqlite3
import smtplib
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import re


# ----------------------------
# Load Environment Variables
# ----------------------------
load_dotenv()

app = Flask(
    __name__,
    static_folder="static",
    template_folder="templates"
)

DB_PATH = os.path.join(os.path.dirname(__file__), "data.db")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

# Email Configuration
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@travelaiagent.com")

print("🔧 Email configuration loaded:")
print(f"  SMTP_SERVER: {SMTP_SERVER}")
print(f"  SMTP_PORT: {SMTP_PORT}")
print(f"  SMTP_USERNAME: {'[configured]' if SMTP_USERNAME else '[missing]'}")
print(f"  ADMIN_EMAIL: {ADMIN_EMAIL}")
if SMTP_USERNAME in (None, "", "your-email@gmail.com"):
    print("⚠️  WARNING: SMTP_USERNAME is not configured or still uses the placeholder email.")
if SMTP_PASSWORD in (None, "", "your-app-password"):
    print("⚠️  WARNING: SMTP_PASSWORD is not configured or still uses the placeholder app password.")


def get_db_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS trips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            destination TEXT,
            days INTEGER,
            budget TEXT,
            generated_at TEXT,
            plan_json TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS inquiries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            city TEXT,
            state TEXT,
            country TEXT,
            created_at TEXT,
            status TEXT DEFAULT 'new'
        )
    """)
    conn.commit()
    conn.close()


init_db()

# ----------------------------
# CORS
# ----------------------------
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
    return response

# ----------------------------
# Email Functions
# ----------------------------
def is_valid_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def send_email(to_email, subject, html_body, reply_to=None):
    """Send email via SMTP"""
    # Basic validation
    if not is_valid_email(to_email):
        message = f"Invalid recipient email address: {to_email}"
        print(f"❌ {message}")
        return False, message

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    # Use configured username if available, otherwise use a generic sender
    sender_address = SMTP_USERNAME if SMTP_USERNAME and SMTP_USERNAME not in ("your-email@gmail.com", "") else f"no-reply@{os.getenv('HOSTNAME','local') }"
    msg['From'] = f"Travel AI Agent <{sender_address}>"
    msg['To'] = to_email
    if reply_to:
        msg['Reply-To'] = reply_to

    msg.attach(MIMEText(html_body, 'html'))

    # If SMTP credentials are missing or still placeholders, fall back to saving the email locally
    credentials_missing = (not SMTP_USERNAME or not SMTP_PASSWORD or SMTP_USERNAME == "your-email@gmail.com" or SMTP_PASSWORD == "your-app-password")
    if credentials_missing:
        try:
            out_dir = os.path.join(os.path.dirname(__file__), 'sent_emails')
            os.makedirs(out_dir, exist_ok=True)
            safe_to = to_email.replace('@', '_at_').replace('.', '_')
            filename = f"{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}_{safe_to}.html"
            path = os.path.join(out_dir, filename)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(f"<h3>To: {to_email}</h3>\n")
                f.write(f"<h4>Subject: {subject}</h4>\n")
                f.write(html_body)
            message = f"SMTP not configured — saved email to {path}"
            print(f"⚠️  {message}")
            return True, message
        except Exception as e:
            message = f"Failed to save email locally: {e}"
            print(f"❌ {message}")
            return False, message

    # Attempt real SMTP send
    try:
        print(f"📧 Connecting to SMTP server {SMTP_SERVER}:{SMTP_PORT}")
        if SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, timeout=30)
            server.ehlo()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
        else:
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=30)
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)

        with server:
            server.send_message(msg)

        print(f"✅ Email sent successfully to {to_email}")
        return True, None

    except smtplib.SMTPAuthenticationError as auth_err:
        message = f"SMTP authentication failed: {auth_err} — falling back to local save"
        print(f"❌ {message}")
    except smtplib.SMTPRecipientsRefused as refused:
        message = f"Recipient refused: {refused.recipients} — saved locally"
        print(f"❌ {message}")
    except smtplib.SMTPException as smtp_err:
        message = f"SMTP error occurred: {smtp_err} — saved locally"
        print(f"❌ {message}")
    except Exception as e:
        message = f"Email send failed: {str(e)} — saved locally"
        print(f"❌ {message}")

    # On any failure to actually send, save to local folder as fallback and report success
    try:
        out_dir = os.path.join(os.path.dirname(__file__), 'sent_emails')
        os.makedirs(out_dir, exist_ok=True)
        safe_to = to_email.replace('@', '_at_').replace('.', '_')
        filename = f"{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}_{safe_to}_failed.html"
        path = os.path.join(out_dir, filename)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(f"<h3>To: {to_email}</h3>\n")
            f.write(f"<h4>Subject: {subject}</h4>\n")
            f.write(html_body)
        fallback_msg = f"Email saved locally to {path}"
        print(f"⚠️  {fallback_msg}")
        return True, fallback_msg
    except Exception as e:
        fallback_err = f"Failed to save email locally after SMTP error: {e}"
        print(f"❌ {fallback_err}")
        return False, fallback_err

def send_admin_notification(name, email, subject, message, latitude, longitude, city, state, country):
    """Send admin notification email"""
    location_info = f"<p><strong>Location:</strong> {city}, {state}, {country}</p>" if city else ""
    coords_info = f"<p><strong>Coordinates:</strong> Lat {latitude}, Lng {longitude}</p>" if latitude and longitude else ""
    
    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> {name}</p>
            <p><strong>Email:</strong> {email}</p>
            <p><strong>Subject:</strong> {subject}</p>
            <h3>Message:</h3>
            <p>{message}</p>
            {location_info}
            {coords_info}
            <hr>
            <p><small>Received on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}</small></p>
        </body>
    </html>
    """
    return send_email(ADMIN_EMAIL, f"New Contact: {subject}", html_body, reply_to=email)

def send_user_confirmation(name, email, subject, message):
    """Send confirmation email to user"""
    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333; background: linear-gradient(135deg, #041626 0%, #0a1f34 100%); padding: 20px;">
            <div style="background: rgba(255, 255, 255, 0.95); padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #041626; text-align: center;">Thank You for Contacting Travel AI Agent</h2>
                <p>Dear <strong>{name}</strong>,</p>
                <p>Thank you for reaching out to us! We have received your inquiry and appreciate you taking the time to contact us.</p>
                <h3 style="color: #63b8ff;">Your Message Details:</h3>
                <p><strong>Subject:</strong> {subject}</p>
                <p><strong>Message:</strong></p>
                <p style="background: #f5f5f5; padding: 15px; border-left: 4px solid #63b8ff; border-radius: 4px;">{message}</p>
                <hr>
                <p>Our team will review your message and get back to you within 24 hours. In the meantime, feel free to check out our services and features.</p>
                <p style="text-align: center; margin-top: 30px;">
                    <a href="https://travelaiagent.com" style="background: linear-gradient(90deg, #4e98ff, #79d2ff); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Visit Our Website</a>
                </p>
                <hr>
                <p style="color: #999; font-size: 12px; text-align: center;">© 2024 Travel AI Agent. All rights reserved.</p>
            </div>
        </body>
    </html>
    """
    return send_email(email, "Thank You for Contacting Travel AI Agent", html_body, reply_to=ADMIN_EMAIL)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

client = None
model = None
using_new_genai = False

try:
    if GOOGLE_API_KEY:
        try:
            from google import genai
            client = genai.Client(api_key=GOOGLE_API_KEY)
            using_new_genai = True
            print("✅ Google GenAI (new package) connected successfully")
        except (ImportError, ModuleNotFoundError):
            import google.generativeai as genai
            genai.configure(api_key=GOOGLE_API_KEY)
            model = genai.GenerativeModel(model_name=GEMINI_MODEL)
            print("✅ Gemini Connected Successfully (legacy package)")
    else:
        print("❌ GOOGLE_API_KEY not found")

except Exception as e:
    print("❌ Gemini Setup Error:", str(e))


# ----------------------------
# Home Page
# ----------------------------
@app.route("/")
def index():
    # Server-side destination data to ensure images load via Flask `static` folder
    destinations = [
        {
            "id": "manali",
            "name": "Manali",
            "location": "Himachal Pradesh, India",
            "rating": 4.9,
            "image": "manali.jpg",
            "imageAlt": "Snow mountains and Himalayan landscape",
            "description": "Manali is a mountain resort town nestled in the Himalayas, known for snow-capped peaks, lush pine forests, rivers, and adventure activities.",
            "bestTime": "October to February",
            "attractions": ["Rohtang Pass", "Solang Valley", "Hadimba Temple", "Old Manali Market"],
            "budget": "₹35,000 – ₹55,000",
            "duration": "4–6 Days",
        },
        {
            "id": "maldives",
            "name": "Maldives",
            "location": "Indian Ocean",
            "rating": 4.8,
            "image": "maldives.jpg",
            "imageAlt": "Turquoise water and beach villas in the Maldives",
            "description": "The Maldives offers stunning overwater villas, pristine beaches, crystal-clear lagoons, and serene island escapes for romantic and luxury stays.",
            "bestTime": "November to April",
            "attractions": ["Water villa stay", "Snorkeling with manta rays", "Sunset dolphin cruise", "Private island dining"],
            "budget": "₹1,20,000 – ₹2,50,000",
            "duration": "5–7 Days",
        },
        {
            "id": "paris",
            "name": "Paris",
            "location": "France",
            "rating": 4.7,
            "image": "paris.jpg",
            "imageAlt": "Eiffel Tower and Paris city skyline",
            "description": "Paris is famous for the Eiffel Tower, world-class museums, romantic boulevards, luxury shopping, and iconic historic architecture.",
            "bestTime": "April to June, September to October",
            "attractions": ["Eiffel Tower", "Louvre Museum", "Arc de Triomphe", "Seine River Cruise"],
            "budget": "₹80,000 – ₹1,50,000",
            "duration": "4–6 Days",
        },
        {
            "id": "bali",
            "name": "Bali",
            "location": "Indonesia",
            "rating": 4.8,
            "image": "bali.jpg",
            "imageAlt": "Bali temple, rice terraces, and tropical beach",
            "description": "Bali is a lush Indonesian island with temples, rice terraces, volcanic hills, vibrant beaches, and a spiritual creative culture.",
            "bestTime": "April to June, September to October",
            "attractions": ["Ubud Rice Terraces", "Tanah Lot Temple", "Kuta Beach", "Sacred Monkey Forest"],
            "budget": "₹45,000 – ₹85,000",
            "duration": "5–7 Days",
        },
        {
            "id": "dubai",
            "name": "Dubai",
            "location": "UAE",
            "rating": 4.9,
            "image": "dubai.jpg",
            "imageAlt": "Burj Khalifa and Dubai modern skyline",
            "description": "Dubai blends futuristic skyscrapers, luxury shopping, desert adventures, and glamorous nightlife around the Burj Khalifa skyline.",
            "bestTime": "November to March",
            "attractions": ["Burj Khalifa", "The Dubai Mall", "Desert safari", "Palm Jumeirah"],
            "budget": "₹60,000 – ₹1,20,000",
            "duration": "4–5 Days",
        },
    ]

    return render_template("index.html", destinations=destinations)


# ----------------------------
# Gemini Helper
# ----------------------------
def generate_gemini_text(prompt):
    try:
        if client:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt
            )
        elif model:
            response = model.generate_content(prompt)
        else:
            return None

        if hasattr(response, "text"):
            return response.text
        if isinstance(response, dict):
            return response.get("text") or response.get("response") or str(response)
        return str(response)

    except Exception as e:
        print("Gemini Error:", str(e))
        return None


# ----------------------------
# Travel Plan Prompt
# ----------------------------
def build_itinerary_prompt(destination, days, budget):
    return f"""
You are a professional AI Travel Planner.

Create a detailed travel itinerary.

Destination: {destination}
Duration: {days} days
Budget: {budget}

Requirements:

- Create exactly {days} days.
- Each day should contain:
  - Morning
  - Afternoon
  - Evening
- Recommend attractions.
- Recommend local food.
- Recommend transportation.
- Include estimated daily costs.
- Include travel tips.
- Do not repeat activities.

Format:

TRIP OVERVIEW

DAY 1
Morning:
Afternoon:
Evening:
Food Recommendations:
Transportation:
Estimated Cost:
Travel Tips:

Continue until DAY {days}

TOTAL BUDGET SUMMARY

GENERAL TRAVEL TIPS
"""


# ----------------------------
# Generate Travel Plan API
# ----------------------------
@app.route("/api/generate-plan", methods=["POST"])
def generate_plan():
    try:
        data = request.get_json() or {}

        destination = data.get("destination", "").strip()
        days = int(data.get("days", 1))
        budget = data.get("budget", "").strip()

        if not destination:
            return jsonify({
                "error": "Destination is required"
            }), 400

        if days < 1:
            return jsonify({
                "error": "Days must be at least 1"
            }), 400

        prompt = build_itinerary_prompt(
            destination,
            days,
            budget
        )

        result = generate_gemini_text(prompt)

        if not result:
            return jsonify({
                "error": "Failed to generate itinerary. Check Gemini API key."
            }), 500

        return jsonify({
            "destination": destination,
            "days": days,
            "budget": budget,
            "plan": result
        })

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


# ----------------------------
# Chat API
# ----------------------------
@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json()

        if not data or "message" not in data:
            return jsonify({"reply": "Invalid request"}), 400

        message = data["message"].strip()

        if not message:
            return jsonify({"reply": "Please enter a message"}), 400

        # =========================
        # 🧠 SMART TRAVEL PROMPT
        # =========================
        prompt = f"""
You are a Smart Travel AI Assistant.

RULES:
- Answer ONLY the user question.
- Do NOT change existing behavior of chatbot.
- Do NOT assume previous conversation.
- Keep response natural and simple.

EXTRA FEATURE (ONLY IF USER ASKS ABOUT ANY PLACE):
- If the user mentions any location or travel place, also include:
  - Place name
  - Short description
  - Location (city, country)
  - Google Maps link in this format:
    https://www.google.com/maps/search/?api=1&query=PLACE_NAME

IMPORTANT:
- Do NOT break existing chatbot functionality.
- Do NOT add unnecessary formatting.
- Only add map link when place is mentioned.

User Question:
{message}

Answer:
"""

        reply = generate_gemini_text(prompt)

        # =========================
        # ⚠️ ERROR HANDLING
        # =========================
        if reply is None:
            return jsonify({
                "reply": "AI service unavailable. Check API key or internet connection."
            }), 500

        return jsonify({
            "reply": reply,
            "status": "success"
        })

    except Exception as e:
        print("Server Error:", e)
        return jsonify({
            "reply": "Server error occurred. Please check backend logs."
        }), 500


# ----------------------------
# Trip Storage Helpers
# ----------------------------

def serialize_trip_row(row):
    plan = None
    try:
        plan = json.loads(row["plan_json"]) if row["plan_json"] else None
    except Exception:
        plan = row["plan_json"]

    return {
        "id": row["id"],
        "destination": row["destination"],
        "days": row["days"],
        "budget": row["budget"],
        "generated_at": row["generated_at"],
        "plan": plan
    }


@app.route("/api/save-trip", methods=["POST"])
def save_trip():
    try:
        data = request.get_json() or {}
        destination = data.get("destination", "").strip()
        days = int(data.get("days", 1))
        budget = data.get("budget", "").strip()
        plan = data.get("itinerary") or data.get("plan") or data.get("plan_text") or data.get("plan_json") or data

        if not destination:
            return jsonify({"error": "Destination is required"}), 400

        plan_json = json.dumps(plan, default=str)

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO trips (destination, days, budget, generated_at, plan_json) VALUES (?, ?, ?, ?, ?)",
            (destination, days, budget, datetime.utcnow().isoformat(), plan_json)
        )
        conn.commit()
        trip_id = cursor.lastrowid
        conn.close()

        return jsonify({"status": "saved", "id": trip_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/my-trips")
def my_trips():
    try:
        conn = get_db_connection()
        rows = conn.execute("SELECT * FROM trips ORDER BY generated_at DESC").fetchall()
        conn.close()

        trips = [serialize_trip_row(row) for row in rows]
        return jsonify({"trips": trips})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/delete-trip/<int:trip_id>", methods=["DELETE"])
def delete_trip(trip_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM trips WHERE id = ?", (trip_id,))
        conn.commit()
        deleted = cursor.rowcount
        conn.close()

        if not deleted:
            return jsonify({"error": "Trip not found"}), 404

        return jsonify({"status": "deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ----------------------------
# Gemini Test Route
# ----------------------------
@app.route("/test-gemini")
def test_gemini():

    result = generate_gemini_text(
        "Tell me about Paris in 50 words."
    )

    return jsonify({
        "response": result
    })


# ----------------------------
# Contact Form Handler
# ----------------------------
@app.route("/api/contact", methods=["POST"])
def handle_contact():
    """Handle contact form submissions"""
    try:
        print(f"📧 Contact form request received from {request.remote_addr}")
        
        data = request.get_json()
        if not data:
            print("❌ No JSON data received")
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400

        # Validate required fields - safely handle None values
        name = (data.get("name") or "").strip()
        email = (data.get("email") or "").strip()
        subject = (data.get("subject") or "").strip()
        message = (data.get("message") or "").strip()

        print(f"📧 Contact data: name={name[:20] if name else 'empty'}, email={email}, subject={subject[:30] if subject else 'empty'}")

        if not all([name, email, subject, message]):
            print("❌ Missing required fields")
            return jsonify({
                "success": False,
                "error": "All required fields must be filled."
            }), 400

        # Validate email format
        if not is_valid_email(email):
            print(f"❌ Invalid email format: {email}")
            return jsonify({
                "success": False,
                "error": "Please provide a valid email address."
            }), 400

        # Sanitize inputs
        name = name.replace("<", "&lt;").replace(">", "&gt;")
        email = email.replace("<", "&lt;").replace(">", "&gt;")
        subject = subject.replace("<", "&lt;").replace(">", "&gt;")
        message = message.replace("<", "&lt;").replace(">", "&gt;")

        # Get optional location data - safely handle None values
        latitude = data.get("latitude")
        longitude = data.get("longitude")
        city = (data.get("city") or "").strip()
        state = (data.get("state") or "").strip()
        country = (data.get("country") or "").strip()

        print(f"📧 Location data: {city or 'N/A'}, {state or 'N/A'}, {country or 'N/A'} ({latitude}, {longitude})")

        # Store in database
        try:
            conn = get_db_connection()
            cursor = conn.execute("""
                INSERT INTO inquiries (name, email, subject, message, latitude, longitude, city, state, country, created_at, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (name, email, subject, message, latitude, longitude, city or None, state or None, country or None, datetime.utcnow().isoformat(), 'new'))
            inquiry_id = cursor.lastrowid
            conn.commit()
            conn.close()
            print(f"✅ Contact stored in database with ID {inquiry_id}")
        except Exception as db_err:
            print(f"❌ Database error: {str(db_err)}")
            raise

        # Send emails and require actual delivery for success
        admin_sent = False
        user_sent = False
        email_errors = []

        print("Contact form received")
        print("Sending admin email")
        admin_sent, admin_error = send_admin_notification(name, email, subject, message, latitude, longitude, city, state, country)
        if admin_sent:
            print("✅ Admin notification sent")
        else:
            email_errors.append(f"Admin notification failed: {admin_error}")
            print(f"❌ Admin notification failed: {admin_error}")

        print("Sending user confirmation email")
        user_sent, user_error = send_user_confirmation(name, email, subject, message)
        if user_sent:
            print("✅ User confirmation sent")
        else:
            email_errors.append(f"User confirmation failed: {user_error}")
            print(f"❌ User confirmation failed: {user_error}")

        if not admin_sent or not user_sent:
            error_msg = " ".join(email_errors)
            print(f"❌ Contact form email delivery issue: {error_msg}")
            return jsonify({
                "success": False,
                "error": error_msg
            }), 502

        print(f"✅ Contact form successfully processed (ID: {inquiry_id})")
        return jsonify({
            "success": True,
            "message": "Contact form submitted successfully",
            "inquiry_id": inquiry_id
        }), 200

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ Contact form error: {str(e)}")
        print(f"Error details:\n{error_details}")
        return jsonify({
            "success": False,
            "error": f"Server error: {str(e)}"
        }), 500


# ----------------------------
# Health Check
# ----------------------------
@app.route("/health")
def health():
    return jsonify({
        "status": "running",
        "gemini_connected": model is not None
    })


# ----------------------------
# Run Flask
# ----------------------------
if __name__ == "__main__":
    print("🚀 Starting Flask Server...")
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )