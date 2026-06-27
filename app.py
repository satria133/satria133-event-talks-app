import os
import time
import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request
from bs4 import BeautifulSoup

app = Flask(__name__)

# Cache configuration
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
cache = {
    "data": None,
    "last_fetched": 0
}
CACHE_DURATION_SECS = 300  # 5 minutes cache

def parse_content_html(html_str):
    """
    Parses the BigQuery release notes HTML content and splits it into
    individual change items (e.g. Features, Changes, Deprecations)
    based on the h3 headers present in the Atom feed entry.
    """
    if not html_str:
        return []
    
    soup = BeautifulSoup(html_str, 'html.parser')
    updates = []
    
    # We will traverse the elements of the HTML.
    # Typically, the Atom feed entry has h3 tags (like '<h3>Feature</h3>' or '<h3>Change</h3>')
    # followed by the text of that update.
    current_type = "Update"
    current_elements = []
    
    for child in soup.children:
        # Ignore empty whitespace strings
        if isinstance(child, str) and not child.strip():
            continue
            
        if getattr(child, 'name', None) in ['h1', 'h2', 'h3', 'h4']:
            # Save the accumulated elements of the previous header
            if current_elements:
                content_html = "".join(str(e) for e in current_elements)
                content_text = "".join(e.get_text() if hasattr(e, 'get_text') else str(e) for e in current_elements).strip()
                updates.append({
                    "type": current_type,
                    "content_html": content_html,
                    "content_text": content_text
                })
                current_elements = []
            current_type = child.get_text().strip()
        else:
            current_elements.append(child)
            
    # Add the last block of content
    if current_elements or current_type != "Update":
        content_html = "".join(str(e) for e in current_elements)
        content_text = "".join(e.get_text() if hasattr(e, 'get_text') else str(e) for e in current_elements).strip()
        updates.append({
            "type": current_type,
            "content_html": content_html,
            "content_text": content_text
        })
        
    # Fallback: if no headers were found, just treat the whole content as one update
    if not updates and html_str.strip():
        updates.append({
            "type": "Update",
            "content_html": html_str,
            "content_text": soup.get_text().strip()
        })
        
    return updates

def fetch_and_parse_feed(force_refresh=False):
    """
    Fetches the Atom feed from BigQuery release notes and parses it.
    Uses caching unless force_refresh is True.
    """
    now = time.time()
    if not force_refresh and cache["data"] is not None and (now - cache["last_fetched"]) < CACHE_DURATION_SECS:
        return cache["data"], False  # False indicates it was fetched from cache
        
    try:
        # Fetch the feed XML
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        req = urllib.request.Request(FEED_URL, headers=headers)
        with urllib.request.urlopen(req) as response:
            xml_data = response.read()
            
        # Parse XML
        root = ET.fromstring(xml_data)
        
        # Determine XML namespace
        ns = ""
        if '}' in root.tag:
            ns = root.tag.split('}')[0] + '}'
            
        entries = root.findall(f"{ns}entry")
        parsed_entries = []
        
        for entry in entries:
            title = entry.find(f"{ns}title")
            title_text = title.text.strip() if title is not None else "No Title"
            
            updated = entry.find(f"{ns}updated")
            updated_text = updated.text.strip() if updated is not None else ""
            
            entry_id = entry.find(f"{ns}id")
            id_text = entry_id.text.strip() if entry_id is not None else ""
            
            content_elem = entry.find(f"{ns}content")
            content_html = content_elem.text if content_elem is not None else ""
            
            # Split the HTML content into structured sub-updates
            sub_updates = parse_content_html(content_html)
            
            parsed_entries.append({
                "date": title_text,
                "updated": updated_text,
                "id": id_text,
                "updates": sub_updates
            })
            
        cache["data"] = parsed_entries
        cache["last_fetched"] = now
        return parsed_entries, True  # True indicates a fresh fetch was completed
        
    except Exception as e:
        print("Error fetching/parsing feed:", e)
        # If fetch fails, return cached data if available, or raise error
        if cache["data"] is not None:
            return cache["data"], False
        raise e

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/releases")
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        data, is_fresh = fetch_and_parse_feed(force_refresh=force_refresh)
        return jsonify({
            "success": True,
            "is_fresh": is_fresh,
            "last_fetched": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(cache["last_fetched"])),
            "data": data
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
