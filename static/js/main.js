// Global Application State
const state = {
    rawFeedData: [],
    filteredUpdates: [],
    selectedUpdates: new Map(), // Map of compositeKey -> { date, type, text }
    activeCategory: 'all',
    searchQuery: '',
    lastFetched: 'Never'
};

// Official URL for BigQuery Release Notes
const BQ_RELEASE_NOTES_URL = "https://cloud.google.com/bigquery/docs/release-notes";

// DOM Elements
const elements = {
    btnRefresh: document.getElementById('btn-refresh'),
    refreshSpinner: document.getElementById('refresh-spinner'),
    lastFetchedTime: document.getElementById('last-fetched-time'),
    statusBadge: document.getElementById('status-badge'),
    searchInput: document.getElementById('search-input'),
    filterTags: document.querySelectorAll('.filter-tag'),
    loadingState: document.getElementById('loading-state'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    emptyState: document.getElementById('empty-state'),
    feedList: document.getElementById('feed-list'),
    btnRetry: document.getElementById('btn-retry'),
    
    // Tweet Drawer Elements
    tweetDrawer: document.getElementById('tweet-drawer'),
    selectedCount: document.getElementById('selected-count'),
    btnClearSelection: document.getElementById('btn-clear-selection'),
    btnTweetSelected: document.getElementById('btn-tweet-selected'),
    
    // Toast Container
    toastContainer: document.getElementById('toast-container')
};

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // Fetch initial release notes
    fetchReleases(false);
    
    // Event Listeners
    elements.btnRefresh.addEventListener('click', () => fetchReleases(true));
    elements.btnRetry.addEventListener('click', () => fetchReleases(true));
    elements.searchInput.addEventListener('input', handleSearch);
    elements.btnClearSelection.addEventListener('click', clearSelection);
    elements.btnTweetSelected.addEventListener('click', shareSelectedOnTwitter);
    
    // Filter tags setup
    elements.filterTags.forEach(tag => {
        tag.addEventListener('click', (e) => {
            // Remove active class from all tags
            elements.filterTags.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tag
            const target = e.currentTarget;
            target.classList.add('active');
            
            // Set state and render
            state.activeCategory = target.getAttribute('data-category');
            renderFeed();
        });
    });
}

// Fetch Release Notes from API
async function fetchReleases(forceRefresh = false) {
    showLoading(true);
    
    if (forceRefresh) {
        elements.refreshSpinner.classList.add('spin');
        elements.statusBadge.className = 'status-indicator syncing';
        elements.statusBadge.innerHTML = '<span class="dot"></span> Syncing...';
    }
    
    try {
        const response = await fetch(`/api/releases?refresh=${forceRefresh}`);
        const result = await response.json();
        
        if (result.success) {
            state.rawFeedData = result.data;
            state.lastFetched = result.last_fetched;
            
            elements.lastFetchedTime.textContent = state.lastFetched;
            elements.statusBadge.className = 'status-indicator online';
            elements.statusBadge.innerHTML = '<span class="dot"></span> Connected';
            
            showLoading(false);
            renderFeed();
            
            if (forceRefresh) {
                showToast(result.is_fresh ? "Successfully synced fresh release notes!" : "Feed is already up to date.", "success");
            }
        } else {
            throw new Error(result.error || "Failed to load release notes");
        }
    } catch (error) {
        console.error("Fetch Error:", error);
        showLoading(false, true, error.message);
        elements.statusBadge.className = 'status-indicator offline';
        elements.statusBadge.innerHTML = '<span class="dot"></span> Offline';
        showToast("Error synchronizing feed: " + error.message, "error");
    } finally {
        elements.refreshSpinner.classList.remove('spin');
    }
}

// UI State Switcher
function showLoading(isLoading, hasError = false, errMsg = "") {
    if (isLoading) {
        elements.loadingState.classList.remove('hidden');
        elements.errorState.classList.add('hidden');
        elements.emptyState.classList.add('hidden');
        elements.feedList.classList.add('hidden');
    } else if (hasError) {
        elements.loadingState.classList.add('hidden');
        elements.errorState.classList.remove('hidden');
        elements.errorMessage.textContent = errMsg;
        elements.emptyState.classList.add('hidden');
        elements.feedList.classList.add('hidden');
    } else {
        elements.loadingState.classList.add('hidden');
        elements.errorState.classList.add('hidden');
    }
}

// Debounced Search Handler
let searchTimeout;
function handleSearch(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        renderFeed();
    }, 150);
}

// Filter and Process Feed Data
function processFeedData() {
    const filtered = [];
    
    state.rawFeedData.forEach(entry => {
        const matchingUpdates = entry.updates.filter(update => {
            // Category Filter
            const categoryMatches = state.activeCategory === 'all' || 
                update.type.toLowerCase() === state.activeCategory;
            
            // Search Query Filter
            const textMatches = !state.searchQuery || 
                update.content_text.toLowerCase().includes(state.searchQuery) ||
                update.type.toLowerCase().includes(state.searchQuery) ||
                entry.date.toLowerCase().includes(state.searchQuery);
                
            return categoryMatches && textMatches;
        });
        
        if (matchingUpdates.length > 0) {
            filtered.push({
                date: entry.date,
                updated: entry.updated,
                id: entry.id,
                updates: matchingUpdates
            });
        }
    });
    
    state.filteredUpdates = filtered;
}

// Render Release Notes Timeline
function renderFeed() {
    processFeedData();
    
    // Clear current list
    elements.feedList.innerHTML = '';
    
    if (state.filteredUpdates.length === 0) {
        elements.emptyState.classList.remove('hidden');
        elements.feedList.classList.add('hidden');
        return;
    }
    
    elements.emptyState.classList.add('hidden');
    elements.feedList.classList.remove('hidden');
    
    state.filteredUpdates.forEach((entry, entryIdx) => {
        const dateGroup = document.createElement('div');
        dateGroup.className = 'date-group';
        dateGroup.style.animationDelay = `${entryIdx * 0.05}s`;
        
        // Date Header
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        dateHeader.innerHTML = `
            <i class="fa-regular fa-calendar-check date-icon"></i>
            <span class="date-title">${entry.date}</span>
        `;
        dateGroup.appendChild(dateHeader);
        
        // Updates List Container
        const updatesList = document.createElement('div');
        updatesList.className = 'updates-list';
        
        entry.updates.forEach((update, updateIdx) => {
            const compositeKey = `${entry.date}__${update.type}__${updateIdx}`;
            const isSelected = state.selectedUpdates.has(compositeKey);
            
            // Card Element
            const updateCard = document.createElement('article');
            updateCard.className = `update-card ${isSelected ? 'selected' : ''}`;
            updateCard.setAttribute('data-key', compositeKey);
            
            // Map types to badges
            const typeLower = update.type.toLowerCase();
            let badgeClass = 'badge-update';
            let badgeIcon = 'fa-solid fa-circle-info';
            
            if (typeLower === 'feature') {
                badgeClass = 'badge-feature';
                badgeIcon = 'fa-solid fa-star';
            } else if (typeLower === 'change') {
                badgeClass = 'badge-change';
                badgeIcon = 'fa-solid fa-wrench';
            } else if (typeLower === 'deprecation') {
                badgeClass = 'badge-deprecation';
                badgeIcon = 'fa-solid fa-triangle-exclamation';
            }
            
            updateCard.innerHTML = `
                <div class="card-select-area">
                    <div class="custom-checkbox" title="Select to tweet">
                        <i class="fa-solid fa-check"></i>
                    </div>
                </div>
                
                <div class="card-content-area">
                    <div class="card-header-row">
                        <span class="badge ${badgeClass}">
                            <i class="${badgeIcon}"></i> ${update.type}
                        </span>
                        
                        <div class="card-actions">
                            <button class="btn-icon-tweet single-tweet-btn" title="Tweet this update">
                                <i class="fa-brands fa-x-twitter"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="update-desc">
                        ${update.content_html}
                    </div>
                </div>
            `;
            
            // Event Listeners for Card Interaction
            
            // Checkbox click
            const selectArea = updateCard.querySelector('.card-select-area');
            selectArea.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSelection(compositeKey, entry.date, update.type, update.content_text);
            });
            
            // Entire card click (excluding links & buttons)
            updateCard.addEventListener('click', (e) => {
                // If user is clicking a link or a tweet button, do not toggle checkbox
                if (e.target.tagName === 'A' || e.target.closest('.single-tweet-btn') || e.target.closest('code')) {
                    return;
                }
                toggleSelection(compositeKey, entry.date, update.type, update.content_text);
            });
            
            // Single Tweet Button click
            const tweetBtn = updateCard.querySelector('.single-tweet-btn');
            tweetBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                shareSingleOnTwitter(entry.date, update.type, update.content_text);
            });
            
            updatesList.appendChild(updateCard);
        });
        
        dateGroup.appendChild(updatesList);
        elements.feedList.appendChild(dateGroup);
    });
}

// Selection Manager
function toggleSelection(key, date, type, text) {
    const card = document.querySelector(`.update-card[data-key="${key}"]`);
    
    if (state.selectedUpdates.has(key)) {
        state.selectedUpdates.delete(key);
        if (card) card.classList.remove('selected');
    } else {
        state.selectedUpdates.set(key, { date, type, text });
        if (card) card.classList.add('selected');
    }
    
    updateTweetDrawer();
}

function clearSelection() {
    state.selectedUpdates.clear();
    
    // Remove selection UI classes
    document.querySelectorAll('.update-card.selected').forEach(card => {
        card.classList.remove('selected');
    });
    
    updateTweetDrawer();
    showToast("Selection cleared", "info");
}

function updateTweetDrawer() {
    const count = state.selectedUpdates.size;
    elements.selectedCount.textContent = count;
    
    if (count > 0) {
        elements.tweetDrawer.classList.add('active');
        elements.selectedCount.classList.add('pulse');
        
        if (count === 1) {
            elements.tweetDrawer.querySelector('#drawer-preview-text').textContent = "1 release selected. Ready to share.";
        } else {
            elements.tweetDrawer.querySelector('#drawer-preview-text').textContent = `${count} releases selected. Ready to share summary.`;
        }
    } else {
        elements.tweetDrawer.classList.remove('active');
    }
}

// Twitter Broadcast Functionality
function shareSingleOnTwitter(date, type, text) {
    const tweetText = composeSingleTweetText(date, type, text);
    openTwitterIntent(tweetText);
}

function shareSelectedOnTwitter() {
    if (state.selectedUpdates.size === 0) return;
    
    const selectedList = Array.from(state.selectedUpdates.values());
    let tweetText = "";
    
    if (selectedList.length === 1) {
        tweetText = composeSingleTweetText(selectedList[0].date, selectedList[0].type, selectedList[0].text);
    } else {
        tweetText = composeMultipleTweetText(selectedList);
    }
    
    openTwitterIntent(tweetText);
}

// Twitter Post Composers (with length safety constraints)
function composeSingleTweetText(date, type, text) {
    const prefix = `🚀 #BigQuery Update (${date})\n[${type}] `;
    const suffix = `\n\nDetails: ${BQ_RELEASE_NOTES_URL}\n#GoogleCloud #DataEngineering`;
    
    // Twitter/X counts all URLs as exactly 23 characters
    const urlLengthInTwitter = 23;
    
    // Compute total weights of variable characters
    // Suffix weight: suffix string length, replacing BQ_RELEASE_NOTES_URL length with 23
    const suffixWeight = suffix.length - BQ_RELEASE_NOTES_URL.length + urlLengthInTwitter;
    const prefixWeight = prefix.length;
    
    // Max characters allowed in X: 280
    const maxTextLen = 280 - prefixWeight - suffixWeight;
    
    let cleanText = cleanTextForTweet(text);
    if (cleanText.length > maxTextLen) {
        cleanText = cleanText.substring(0, maxTextLen - 3) + "...";
    }
    
    return `${prefix}${cleanText}${suffix}`;
}

function composeMultipleTweetText(selectedList) {
    const prefix = `🚀 #BigQuery Updates Summary\n`;
    const suffix = `\n\nDetails: ${BQ_RELEASE_NOTES_URL}\n#GoogleCloud`;
    
    const urlLengthInTwitter = 23;
    const suffixWeight = suffix.length - BQ_RELEASE_NOTES_URL.length + urlLengthInTwitter;
    const prefixWeight = prefix.length;
    
    const maxTextLen = 280 - prefixWeight - suffixWeight;
    
    let listContent = "";
    selectedList.forEach(item => {
        // Shorten the date to just month and day if possible (e.g. "June 25, 2026" -> "June 25")
        const shortDate = item.date.split(',')[0].trim();
        const cleanText = cleanTextForTweet(item.text);
        
        listContent += `• [${shortDate}] (${item.type}) ${cleanText}\n`;
    });
    
    listContent = listContent.trim();
    
    if (listContent.length > maxTextLen) {
        listContent = listContent.substring(0, maxTextLen - 3) + "...";
    }
    
    return `${prefix}${listContent}${suffix}`;
}

// Utility to strip excess spacing and formatting for clean social texts
function cleanTextForTweet(text) {
    return text
        .replace(/\s+/g, ' ')      // Replace multiple spaces/newlines with a single space
        .replace(/\[/g, '(')       // Replace brackets to avoid formatting conflicts
        .replace(/\]/g, ')')
        .trim();
}

function openTwitterIntent(text) {
    const encodedText = encodeURIComponent(text);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
    
    // Open in a new tab/window
    window.open(twitterUrl, '_blank', 'noopener,noreferrer,width=550,height=420');
    showToast("Twitter sharing dialog opened!", "success");
}

// Toast Notifications System
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'fa-solid fa-circle-info';
    if (type === 'success') icon = 'fa-solid fa-circle-check';
    if (type === 'error') icon = 'fa-solid fa-circle-exclamation';
    
    toast.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Trigger animation slide-in
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Auto-destruct after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 350);
    }, 4000);
}
