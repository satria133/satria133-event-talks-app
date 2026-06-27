# BigQuery Release Notes Hub & Twitter Broadcaster

An elegant, glassmorphic Single Page Application (SPA) designed to parse, search, filter, and share official Google Cloud BigQuery release updates on X/Twitter.

Built using a lightweight **Python Flask** backend and high-fidelity **Vanilla HTML, CSS, and JavaScript** frontend.

---

## ✨ Features

- **Granular Update Parsing**: Splits combined daily release notes feed entries into single change cards categorized as `Feature`, `Change`, or `Deprecation` using `BeautifulSoup`.
- **Live Search & Category Filtering**: Real-time client-side search box and category tags filter.
- **Smart X/Twitter Broadcasts**:
  - Click the share button on any update to compose a tweet instantly.
  - Select multiple updates across different dates and click **Tweet Selected** to compile a summarized bulletin.
  - **Char-limit safe**: Smart client-side compositor truncates text automatically to fit the **280-character limit** while retaining official URLs (counted as 23 chars) and hashtags (`#BigQuery #GoogleCloud`).
- **Caching Proxy**: Caches the parsed XML feed for 5 minutes server-side to prevent rate-limiting and accelerate client page loads.
- **Responsive Layout**: Designed using CSS grids, variables, and flexbox for mobile, tablet, and widescreen monitors.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.12+, Flask, xml.etree.ElementTree, BeautifulSoup4
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom properties, Glassmorphism, animations), Vanilla ES6 JavaScript
- **Icons**: FontAwesome 6

---

## 🚀 Quick Start & Installation

### 1. Prerequisites
Ensure you have **Python 3** installed on your system.

### 2. Clone the Repository
```bash
git clone https://github.com/satria133/satria133-event-talks-app.git
cd satria133-event-talks-app
```

### 3. Create & Activate Virtual Environment
On Windows (PowerShell):
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```
On macOS/Linux:
```bash
python3 -m venv venv
source venv/bin/activate
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### 5. Run the Server
```bash
python app.py
```
Open your browser and navigate to **[http://127.0.0.1:5000](http://127.0.0.1:5000)**.

---

## 📂 Project Structure

```text
├── app.py                  # Flask Application & XML Parser Engine
├── requirements.txt        # Backend dependencies
├── .gitignore              # Git ignore rules
├── templates/
│   └── index.html          # Main HTML entry document
└── static/
    ├── css/
    │   └── style.css       # Layout styles & Glassmorphism variables
    └── js/
        └── main.js         # State machine, DOM renderer, and Tweet compiler
```

---

## 🔄 How the XML Feed is Parsed

The official BigQuery feed serves entries with HTML content containing headers:
```html
<h3>Feature</h3>
<p>You can now use...</p>
<h3>Change</h3>
<p>An updated version...</p>
```
The Flask backend extracts this block and splits elements on header nodes (`<h3>`). This creates discrete, structured records returned in a JSON format:
```json
{
  "date": "June 25, 2026",
  "updates": [
    {
      "type": "Feature",
      "content_html": "<p>You can now use...</p>",
      "content_text": "You can now use..."
    }
  ]
}
```
This enables the front end to render discrete cards with selection states for composing social posts.
