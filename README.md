# Travel AI Agent

A premium travel-tech landing page built with modern glassmorphism UI, live Google Maps embed, an AI-style chatbot widget, and responsive design.

## Folder structure

```
travel-agent-ai/
├── assets/
│   └── images/
├── scripts/
│   └── main.js
├── styles/
│   └── styles.css
├── index.html
└── README.md
```

## Files

- `index.html` — main landing page markup
- `styles/styles.css` — page styling and layout
- `scripts/main.js` — chat widget interaction logic
- `assets/images/` — optional local image assets

## How to run

### Static preview

1. Open `index.html` in your browser.
2. Or use a local server such as Live Server in VS Code.

### Run with Flask (recommended for full functionality)

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. (Optional) To enable AI features, set your Google Gemini API key as an environment variable:

Windows (PowerShell):

```powershell
$Env:GOOGLE_API_KEY = "AIza..."
```

macOS / Linux:

```bash
export GOOGLE_API_KEY="AIza..."
```

You can also choose a model via `GEMINI_MODEL` (default `gemini-1.5-flash`).

Note: the `.env` file must be placed in the project root, not inside `templates/`.

Alternative: create a `.env` file in the project root with your key:

```
GOOGLE_API_KEY=AIza...
# Optional: GEMINI_MODEL=gemini-1.5-pro
```

The app will automatically load `.env` if `python-dotenv` is installed.

### Get a Gemini API Key

1. Go to https://ai.google.dev/
2. Click **Get API Key** and sign in with your Google account
3. Create a new API key
4. Copy the key (starts with `AIza`)

3. Start the Flask server:

```bash
python app.py
```

4. Open http://127.0.0.1:5000 — the Generate Plan form and Live Chat will use the backend. If no OpenAI key is set, the app falls back to deterministic/mock responses.

> Note: The chatbot requires the Flask backend. If you open `index.html` directly in the browser without running `app.py`, the chat feature cannot connect to `/api/chat` and will fail.
