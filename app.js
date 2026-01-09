// Main Application Logic
import aiService from './ai-service.js?v=3';
import { PREMIUM_CALCULATOR, FAQ_TEMPLATES } from './knowledge-base.js?v=3';

class InsuranceAIApp {
    constructor() {
        this.conversationHistory = [];
        this.leads = [];
        this.APP_VERSION = '1.1.0'; // Current Version
        this.init();
    }

    init() {
        this.displayVersion();
        this.loadFromStorage();
        this.setupEventListeners();

        this.syncProductSelector();
        this.checkApiKey();
        this.initChatMode();
    }

    // Display App Version
    displayVersion() {
        const versionEl = document.getElementById('appVersion');
        if (versionEl) {
            versionEl.textContent = `v${this.APP_VERSION}`;
        }
    }

    // Initialize chat mode
    initChatMode() {
        const toggle = document.getElementById('chatModeToggle');
        const label = document.getElementById('chatModeLabel');

        // Default to unchecked (New Customer mode)
        // If element doesn't exist (e.g. old HTML cache), skip
        if (!toggle) return;

        toggle.checked = false;
        this.isContinuousMode = false;
        label.textContent = 'ลูกค้าใหม่ (Reset ทุกครั้ง)';
        label.className = 'text-accent';

        toggle.addEventListener('change', (e) => {
            this.isContinuousMode = e.target.checked;
            label.textContent = this.isContinuousMode ? 'คุยต่อเนื่อง (คนเดิม)' : 'ลูกค้าใหม่ (Reset ทุกครั้ง)';
            label.className = this.isContinuousMode ? '' : 'text-accent';

            if (!this.isContinuousMode) {
                this.showToast('โหมดลูกค้าใหม่: ประวัติจะถูก Reset ทุกข้อความ', 'info');
            } else {
                this.showToast('โหมดคุยต่อเนื่อง: AI จะจำประวัติก่อนหน้า', 'success');
            }
        });
    }

    // Sync product selector with saved focus
    syncProductSelector() {
        const focusedProducts = aiService.getProductFocus();
        const selectedProduct = focusedProducts.includes('all') ? 'all' : focusedProducts[0];

        document.querySelectorAll('.product-btn').forEach(btn => {
            if (btn.dataset.product === selectedProduct) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Add custom product
    addCustomProduct() {
        const name = document.getElementById('newProductName').value.trim();
        const ageRange = document.getElementById('newProductAgeRange').value.trim();
        const coverage = document.getElementById('newProductCoverage').value.trim();
        const benefitsText = document.getElementById('newProductBenefits').value.trim();

        if (!name) {
            this.showToast('กรุณาใส่ชื่อโปรดักส์', 'error');
            return;
        }

        // Parse benefits
        const benefits = benefitsText
            .split('\n')
            .map(b => b.trim().replace(/^-\s*/, ''))
            .filter(b => b.length > 0);

        // Create product object
        const customProduct = {
            id: Date.now(),
            name: name,
            ageRange: ageRange || 'ไม่ระบุ',
            coverage: coverage || 'ไม่ระบุ',
            benefits: benefits.length > 0 ? benefits : ['ข้อมูลเพิ่มเติมจากที่ปรึกษา']
        };

        // Save to localStorage
        let customProducts = JSON.parse(localStorage.getItem('custom_products') || '[]');
        customProducts.push(customProduct);
        localStorage.setItem('custom_products', JSON.stringify(customProducts));

        // Clear form
        document.getElementById('newProductName').value = '';
        document.getElementById('newProductAgeRange').value = '';
        document.getElementById('newProductCoverage').value = '';
        document.getElementById('newProductBenefits').value = '';

        // Render
        this.renderCustomProducts();
        this.showToast(`เพิ่มโปรดักส์ "${name}" สำเร็จ!`, 'success');
    }

    // Render custom products
    renderCustomProducts() {
        const customProducts = JSON.parse(localStorage.getItem('custom_products') || '[]');
        const container = document.getElementById('customProductsItems');
        const listDiv = document.getElementById('customProductsList');

        if (customProducts.length === 0) {
            listDiv.style.display = 'none';
            return;
        }

        listDiv.style.display = 'block';
        container.innerHTML = customProducts.map(product => `
            <div style="padding: 0.75rem; background: var(--color-bg-tertiary); border-radius: 8px; border: 1px solid var(--color-border);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                    <strong style="color: var(--color-primary);">${product.name}</strong>
                    <button onclick="app.deleteCustomProduct(${product.id})" style="background: none; border: none; color: var(--color-error); cursor: pointer; font-size: 1.2rem; padding: 0; line-height: 1;">×</button>
                </div>
                <div style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 0.25rem;">
                    อายุ: ${product.ageRange} | ${product.coverage}
                </div>
                <div style="font-size: 0.85rem; color: var(--color-text-secondary);">
                    ${product.benefits.slice(0, 2).join(' • ')}${product.benefits.length > 2 ? '...' : ''}
                </div>
            </div>
        `).join('');
    }

    // Delete custom product
    deleteCustomProduct(productId) {
        if (!confirm('ต้องการลบโปรดักส์นี้ใช่หรือไม่?')) return;

        let customProducts = JSON.parse(localStorage.getItem('custom_products') || '[]');
        customProducts = customProducts.filter(p => p.id !== productId);
        localStorage.setItem('custom_products', JSON.stringify(customProducts));

        this.renderCustomProducts();
        this.showToast('ลบโปรดักส์สำเร็จ', 'success');
    }

    // Load data from localStorage
    loadFromStorage() {
        const savedHistory = localStorage.getItem('conversation_history');
        if (savedHistory) {
            this.conversationHistory = JSON.parse(savedHistory);
        }

        const savedLeads = localStorage.getItem('leads');
        if (savedLeads) {
            this.leads = JSON.parse(savedLeads);
            this.renderLeads();
        }
    }

    // Save data to localStorage
    saveToStorage() {
        localStorage.setItem('conversation_history', JSON.stringify(this.conversationHistory));
        localStorage.setItem('leads', JSON.stringify(this.leads));
    }

    // Setup event listeners
    setupEventListeners() {
        // Chat input
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');

        chatInput.addEventListener('input', () => {
            sendBtn.disabled = !chatInput.value.trim();
        });

        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        sendBtn.addEventListener('click', () => this.sendMessage());

        // Product selector buttons
        document.querySelectorAll('.product-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active from all buttons
                document.querySelectorAll('.product-btn').forEach(b => b.classList.remove('active'));

                // Add active to clicked button
                btn.classList.add('active');

                // Get selected product
                const product = btn.dataset.product;

                // Save to AI service
                if (product === 'all') {
                    aiService.setProductFocus(['all']);
                } else {
                    aiService.setProductFocus([product]);
                }

                // Show feedback
                const productName = btn.textContent.trim();
                this.showToast(`AI จะตอบเกี่ยวกับ: ${productName}`, 'success');
            });
        });

        // Add new product button
        document.getElementById('addProductBtn').addEventListener('click', () => {
            this.addCustomProduct();
        });

        // Template buttons
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                chatInput.value = btn.dataset.template;
                chatInput.focus();
                sendBtn.disabled = false;
            });
        });

        // Response Mode buttons (Comment vs Inbox)
        const commentModeBtn = document.getElementById('commentModeBtn');
        const inboxModeBtn = document.getElementById('inboxModeBtn');
        const responseModeDescription = document.getElementById('responseModeDescription');

        if (commentModeBtn && inboxModeBtn) {
            // Initialize from saved mode
            const savedMode = aiService.getResponseMode();
            this.updateResponseModeUI(savedMode, commentModeBtn, inboxModeBtn, responseModeDescription);

            commentModeBtn.addEventListener('click', () => {
                aiService.setResponseMode('comment');
                this.updateResponseModeUI('comment', commentModeBtn, inboxModeBtn, responseModeDescription);
                this.showToast('โหมดตอบคอมเม้นต์: สั้น กระชับ', 'info');
            });

            inboxModeBtn.addEventListener('click', () => {
                aiService.setResponseMode('inbox');
                this.updateResponseModeUI('inbox', commentModeBtn, inboxModeBtn, responseModeDescription);
                this.showToast('โหมดตอบอินบ็อกซ์: ให้ข้อมูลเยอะกว่า + โน้มน้าว', 'info');
            });
        }

        // Clear chat
        document.getElementById('clearChatBtn').addEventListener('click', () => {
            if (confirm('ต้องการล้างประวัติการสนทนาทั้งหมดใช่หรือไม่?')) {
                this.clearChat();
            }
        });

        // Settings modal
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsModal = document.getElementById('settingsModal');
        const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
        const aiProviderSelect = document.getElementById('aiProvider');

        settingsBtn.addEventListener('click', () => {
            this.openModal(settingsModal);
            const apiKeyInput = document.getElementById('apiKeyInput');

            // Load current provider
            const currentProvider = aiService.getProvider();
            aiProviderSelect.value = currentProvider;

            // Load all API keys for current provider (join with newline)
            const allKeys = aiService.getAllApiKeys();
            apiKeyInput.value = allKeys.join('\n');

            // Load product focus
            const productFocusSelect = document.getElementById('productFocus');
            const focusedProducts = aiService.getProductFocus();
            Array.from(productFocusSelect.options).forEach(option => {
                option.selected = focusedProducts.includes(option.value);
            });

            // Load product training data
            const productTraining = document.getElementById('productTraining');
            productTraining.value = aiService.getProductTraining();

            // Load custom products
            this.renderCustomProducts();

            // Update help text
            this.updateProviderHelp(currentProvider);
        });

        // Handle provider change
        aiProviderSelect.addEventListener('change', () => {
            const newProvider = aiProviderSelect.value;
            aiService.setProvider(newProvider);

            // Load API keys for new provider
            const allKeys = aiService.getAllApiKeys();
            const apiKeyInput = document.getElementById('apiKeyInput');
            apiKeyInput.value = allKeys.join('\n');

            // Update help text
            this.updateProviderHelp(newProvider);
        });

        saveApiKeyBtn.addEventListener('click', () => {
            // Save product focus
            const productFocusSelect = document.getElementById('productFocus');
            const selectedProducts = Array.from(productFocusSelect.selectedOptions).map(opt => opt.value);
            if (selectedProducts.length > 0) {
                aiService.setProductFocus(selectedProducts);
            }

            // Save product training data
            const trainingData = document.getElementById('productTraining').value;
            aiService.setProductTraining(trainingData);

            this.showToast(`บันทึกการตั้งค่าสำเร็จ!`, 'success');
            this.closeModals();

            // Sync product selector buttons
            this.syncProductSelector();
        });

        // History modal
        const historyBtn = document.getElementById('historyBtn');
        const historyModal = document.getElementById('historyModal');

        historyBtn.addEventListener('click', () => {
            this.openModal(historyModal);
            this.renderHistory();
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // Close modal on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModals();
                }
            });
        });
    }

    // Check if API key is set
    checkApiKey() {
        if (!aiService.hasApiKey()) {
            setTimeout(() => {
                this.showToast('กรุณาตั้งค่า API Key ก่อนใช้งาน', 'error');
                const settingsModal = document.getElementById('settingsModal');
                this.openModal(settingsModal);
            }, 1000);
        }
    }

    // Send message
    async sendMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();

        if (!message) return;

        if (!aiService.hasApiKey()) {
            this.showToast('กรุณาตั้งค่า API Key ก่อนใช้งาน', 'error');
            return;
        }

        // Clear input
        chatInput.value = '';
        document.getElementById('sendBtn').disabled = true;

        // Add user message to UI
        this.addMessage('user', message);

        // Add to conversation history
        this.conversationHistory.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Check chat mode
            let historyToSend = this.conversationHistory.slice(-10);

            // If NOT continuous mode (New Customer), send empty history
            if (!this.isContinuousMode) {
                historyToSend = [];
                // Optional: Clear displayed history for visual consistency? 
                // For now, we just don't send it to AI so it treats it as fresh
            }

            // Get AI response
            const response = await aiService.generateResponse(message, historyToSend);

            // Remove typing indicator
            this.removeTypingIndicator();

            // Add AI message to UI
            this.addMessage('ai', response.text, {
                hasLeadAttempt: response.hasLeadAttempt,
                contact: response.detectedContact
            });

            // Add to conversation history
            this.conversationHistory.push({
                role: 'assistant',
                content: response.text,
                timestamp: response.timestamp
            });

            // Handle lead capture
            if (response.detectedContact) {
                this.addLead(response.detectedContact);
            }

            // Save to storage
            this.saveToStorage();

        } catch (error) {
            this.removeTypingIndicator();
            this.showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
            console.error('Error:', error);
        }
    }

    // Add message to chat
    addMessage(role, content, metadata = {}) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;

        const avatar = role === 'user' ? '👤' : '🤖';

        let actionsHTML = '';
        if (role === 'ai') {
            actionsHTML = `
        <div class="message-actions">
          <button class="copy-btn" onclick="app.copyMessage(this)">
            <span class="icon">📋</span>
            <span>คัดลอก</span>
          </button>
        </div>
      `;

            if (metadata.hasLeadAttempt) {
                actionsHTML += `
          <span class="lead-badge">
            <span class="icon">📞</span>
            กำลังขอข้อมูลติดต่อ
          </span>
        `;
            }

            if (metadata.contact) {
                actionsHTML += `
          <span class="lead-badge" style="background: var(--color-success);">
            <span class="icon">✅</span>
            ได้ข้อมูลติดต่อแล้ว: ${metadata.contact.value}
          </span>
        `;
            }
        }

        messageDiv.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        <div class="message-bubble">
          ${this.formatMessage(content)}
        </div>
        ${actionsHTML}
      </div>
    `;

        // Store raw content for copying
        const bubble = messageDiv.querySelector('.message-bubble');
        if (bubble) {
            bubble.dataset.rawContent = content;
        }

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Format message content
    formatMessage(content) {
        // Convert markdown-like formatting to HTML
        let formatted = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>')
            .replace(/- (.*?)(<br>|$)/g, '<li>$1</li>');

        // Wrap consecutive <li> in <ul>
        formatted = formatted.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');

        return `<p>${formatted}</p>`;
    }

    // Copy message
    copyMessage(button) {
        const bubble = button.closest('.message-content').querySelector('.message-bubble');
        const messageContent = bubble.dataset.rawContent || bubble.innerText;

        navigator.clipboard.writeText(messageContent).then(() => {
            const originalHTML = button.innerHTML;
            button.innerHTML = '<span class="icon">✅</span><span>คัดลอกแล้ว!</span>';
            button.classList.add('copied');

            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.classList.remove('copied');
            }, 2000);

            this.showToast('คัดลอกข้อความสำเร็จ!', 'success');
        }).catch(err => {
            this.showToast('ไม่สามารถคัดลอกได้', 'error');
            console.error('Copy failed:', err);
        });
    }

    // Show typing indicator
    showTypingIndicator() {
        const chatMessages = document.getElementById('chatMessages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message ai-message typing-message';
        typingDiv.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <div class="message-bubble">
          <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    `;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Remove typing indicator
    removeTypingIndicator() {
        const typingMessage = document.querySelector('.typing-message');
        if (typingMessage) {
            typingMessage.remove();
        }
    }

    // Clear chat
    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        const messages = chatMessages.querySelectorAll('.message');

        // Remove all except the welcome message
        messages.forEach((msg, index) => {
            if (index > 0) msg.remove();
        });

        this.conversationHistory = [];
        this.saveToStorage();

        this.showToast('ล้างประวัติการสนทนาแล้ว', 'success');
    }

    // Add lead
    addLead(contact) {
        const lead = {
            id: Date.now(),
            type: contact.type,
            value: contact.value,
            raw: contact.raw,
            timestamp: new Date().toISOString()
        };

        this.leads.unshift(lead);
        this.saveToStorage();
        this.renderLeads();

        this.showToast(`ได้รับข้อมูลติดต่อ: ${contact.value}`, 'success');
    }

    // Render leads
    renderLeads() {
        const leadsList = document.getElementById('leadsList');

        if (this.leads.length === 0) {
            leadsList.innerHTML = '<p class="empty-state">ยังไม่มี leads</p>';
            return;
        }

        leadsList.innerHTML = this.leads.map(lead => {
            const time = new Date(lead.timestamp).toLocaleString('th-TH', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });

            const icon = lead.type === 'phone' ? '📱' : '📧';

            return `
        <div class="lead-item">
          <div class="lead-contact">
            <span class="icon">${icon}</span>
            ${lead.value}
          </div>
          <div class="lead-time">${time}</div>
        </div>
      `;
        }).join('');
    }

    // Render history
    renderHistory() {
        const historyList = document.getElementById('historyList');

        if (this.conversationHistory.length === 0) {
            historyList.innerHTML = '<p class="empty-state">ยังไม่มีประวัติการสนทนา</p>';
            return;
        }

        // Group messages by session (every 20 messages or time gap > 1 hour)
        const sessions = [];
        let currentSession = [];

        this.conversationHistory.forEach((msg, index) => {
            if (index > 0) {
                const prevTime = new Date(this.conversationHistory[index - 1].timestamp);
                const currentTime = new Date(msg.timestamp);
                const hoursDiff = (currentTime - prevTime) / (1000 * 60 * 60);

                if (hoursDiff > 1 || currentSession.length >= 20) {
                    sessions.push(currentSession);
                    currentSession = [];
                }
            }
            currentSession.push(msg);
        });

        if (currentSession.length > 0) {
            sessions.push(currentSession);
        }

        historyList.innerHTML = sessions.reverse().map((session, index) => {
            const lastMsg = session[session.length - 1];
            const time = new Date(lastMsg.timestamp).toLocaleString('th-TH', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const messagesHTML = session.map(msg => {
                const role = msg.role === 'user' ? 'user' : 'ai';
                return `
          <div class="history-message ${role}">
            ${msg.content}
          </div>
        `;
            }).join('');

            return `
        <div class="history-item">
          <div class="history-header">
            <strong>Session ${sessions.length - index}</strong>
            <span class="history-time">${time}</span>
          </div>
          <div class="history-messages">
            ${messagesHTML}
          </div>
        </div>
      `;
        }).join('');
    }

    // Modal functions
    openModal(modal) {
        modal.classList.add('active');
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    // Update provider help text
    updateProviderHelp(provider) {
        const providerInfo = {
            groq: {
                name: 'Groq',
                url: 'https://console.groq.com/keys'
            },
            gemini: {
                name: 'Google Gemini',
                url: 'https://aistudio.google.com/app/apikey'
            },
            cohere: {
                name: 'Cohere',
                url: 'https://dashboard.cohere.com/api-keys'
            },
            huggingface: {
                name: 'HuggingFace',
                url: 'https://huggingface.co/settings/tokens'
            }
        };

        const info = providerInfo[provider] || providerInfo.groq;

        const providerName = document.getElementById('providerName');
        if (providerName) {
            providerName.textContent = info.name;
        }

        const helpText = document.getElementById('apiKeyHelp');
        if (helpText) {
            helpText.innerHTML = `
                💡 สามารถใส่หลาย API Keys ได้ (แยกบรรทัด) เพื่อป้องกัน Rate Limit<br>
                ✨ รับ ${info.name} API Key ฟรี:
                <a href="${info.url}" target="_blank" rel="noopener">
                    ${info.url.replace('https://', '')}
                </a>
            `;
        }
    }

    // Update response mode UI
    updateResponseModeUI(mode, commentBtn, inboxBtn, descriptionEl) {
        if (mode === 'inbox') {
            // Inbox mode active
            inboxBtn.style.border = '2px solid var(--color-primary)';
            inboxBtn.style.background = 'rgba(var(--color-primary-rgb), 0.1)';
            inboxBtn.style.color = 'var(--color-primary)';

            commentBtn.style.border = '2px solid var(--color-border)';
            commentBtn.style.background = 'var(--color-bg-tertiary)';
            commentBtn.style.color = 'var(--color-text-secondary)';

            if (descriptionEl) {
                descriptionEl.textContent = '📥 ละเอียดกว่า เป็นกันเอง โน้มน้าวขอเบอร์โทร';
            }
        } else {
            // Comment mode active (default)
            commentBtn.style.border = '2px solid var(--color-primary)';
            commentBtn.style.background = 'rgba(var(--color-primary-rgb), 0.1)';
            commentBtn.style.color = 'var(--color-primary)';

            inboxBtn.style.border = '2px solid var(--color-border)';
            inboxBtn.style.background = 'var(--color-bg-tertiary)';
            inboxBtn.style.color = 'var(--color-text-secondary)';

            if (descriptionEl) {
                descriptionEl.textContent = '✨ สั้น กระชับ เหมาะกับคอมเม้นต์ Facebook';
            }
        }
    }

    // Show toast notification
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;

        // Trigger reflow
        void toast.offsetWidth;

        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize app
const app = new InsuranceAIApp();

// Make app globally available for inline event handlers
window.app = app;

// Export for module usage
export default app;
