// Multi-AI Service - Support for multiple AI providers
import { SYSTEM_PROMPT, INSURANCE_PRODUCTS, PREMIUM_CALCULATOR } from './knowledge-base.js?v=3';

class AIService {
    constructor() {
        this.apiKey = null;
        this.provider = 'groq'; // Default: groq (fastest and free)
        this.conversationHistory = [];

        // API Endpoints for different providers
        this.endpoints = {
            groq: 'https://api.groq.com/openai/v1/chat/completions',
            gemini: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
            cohere: 'https://api.cohere.ai/v1/chat',
            huggingface: 'https://api-inference.huggingface.co/models/meta-llama/Llama-2-70b-chat-hf'
        };

        // Models for each provider
        this.models = {
            groq: 'llama-3.3-70b-versatile',
            gemini: 'gemini-2.5-flash-lite',
            cohere: 'command-r-plus',
            huggingface: 'meta-llama/Llama-2-70b-chat-hf'
        };
    }

    // Set API provider
    setProvider(provider) {
        this.provider = provider;
        localStorage.setItem('ai_provider', provider);
    }

    // Get current provider
    getProvider() {
        if (!this.provider) {
            this.provider = localStorage.getItem('ai_provider') || 'groq';
        }
        return this.provider;
    }

    // Set API key (supports multiple keys, one per line)
    setApiKey(apiKeyInput) {
        const provider = this.getProvider();

        // Parse multiple keys (split by newline, trim, filter empty)
        const keys = apiKeyInput
            .split('\n')
            .map(k => k.trim())
            .filter(k => k.length > 0);

        // Store as JSON array
        localStorage.setItem(`${provider}_api_key`, JSON.stringify(keys));

        // Reset current key index
        localStorage.setItem(`${provider}_key_index`, '0');
    }

    // Get current API key
    getApiKey() {
        const provider = this.getProvider();
        const keysJson = localStorage.getItem(`${provider}_api_key`);

        if (!keysJson) return null;

        const keys = JSON.parse(keysJson);
        if (!Array.isArray(keys) || keys.length === 0) return null;

        // Get current key index
        const currentIndex = parseInt(localStorage.getItem(`${provider}_key_index`) || '0');

        // Return current key
        return keys[currentIndex % keys.length];
    }

    // Get all API keys
    getAllApiKeys() {
        const provider = this.getProvider();
        const keysJson = localStorage.getItem(`${provider}_api_key`);

        if (!keysJson) return [];

        const keys = JSON.parse(keysJson);
        return Array.isArray(keys) ? keys : [];
    }

    // Rotate to next API key
    rotateApiKey() {
        const provider = this.getProvider();
        const keys = this.getAllApiKeys();

        if (keys.length <= 1) {
            console.log('Only one API key available, cannot rotate');
            return false;
        }

        const currentIndex = parseInt(localStorage.getItem(`${provider}_key_index`) || '0');
        const nextIndex = (currentIndex + 1) % keys.length;

        localStorage.setItem(`${provider}_key_index`, nextIndex.toString());

        console.log(`Rotated from key ${currentIndex} to key ${nextIndex}`);
        return true;
    }

    // Check if API key is set
    hasApiKey() {
        return !!this.getApiKey();
    }

    // Set product focus
    setProductFocus(products) {
        localStorage.setItem('product_focus', JSON.stringify(products));
    }

    // Get product focus
    getProductFocus() {
        const saved = localStorage.getItem('product_focus');
        return saved ? JSON.parse(saved) : ['all'];
    }

    // Set product training data
    setProductTraining(data) {
        localStorage.setItem('product_training', data);
    }

    // Get product training data
    getProductTraining() {
        return localStorage.getItem('product_training') || '';
    }

    // Build focused system prompt
    buildFocusedPrompt() {
        const focusedProducts = this.getProductFocus();
        const trainingData = this.getProductTraining();

        let prompt = SYSTEM_PROMPT;

        // Get custom products from localStorage
        const customProducts = JSON.parse(localStorage.getItem('custom_products') || '[]');

        // If specific products are selected (not "all")
        if (!focusedProducts.includes('all')) {
            const selectedProducts = Object.values(INSURANCE_PRODUCTS)
                .filter(p => focusedProducts.includes(p.code));

            prompt += '\n\n**⚠️ สำคัญมาก - กฎเหล็ก:**\n';
            prompt += '1. ตอบเฉพาะแบบประกันที่กำหนดเท่านั้น:\n';
            selectedProducts.forEach(p => {
                prompt += `   - ${p.name} (${p.code})\n`;
            });
            prompt += '\n2. **ห้าม** แนะนำหรือพูดถึงแบบประกันอื่นโดยเด็ดขาด\n';
            prompt += '3. ถ้าลูกค้าถามแบบอื่น ให้บอกว่า "ตอนนี้เรามีโปรโมชั่นพิเศษสำหรับ [ชื่อแบบที่เลือก] ค่ะ"\n';
            prompt += '\n**ข้อมูลแบบประกันที่ต้องเน้น:**\n';
            selectedProducts.forEach(p => {
                prompt += `\n### ${p.name}\n`;
                prompt += `- อายุรับ: ${p.ageRange.min}-${p.ageRange.max} ปี\n`;
                prompt += `- ความคุ้มครอง: ${p.coverage}\n`;
                prompt += '- ประโยชน์:\n';
                p.benefits.forEach(b => {
                    prompt += `  * ${b}\n`;
                });
            });
        }

        // Add custom products (always include if exist)
        if (customProducts.length > 0) {
            prompt += '\n\n**โปรดักส์เพิ่มเติมที่มี:**\n';
            customProducts.forEach(p => {
                prompt += `\n### ${p.name}\n`;
                prompt += `- อายุรับ: ${p.ageRange}\n`;
                prompt += `- ความคุ้มครอง: ${p.coverage}\n`;
                prompt += '- ประโยชน์:\n';
                p.benefits.forEach(b => {
                    prompt += `  * ${b}\n`;
                });
            });
        }

        // Add custom training data
        if (trainingData && trainingData.trim()) {
            prompt += '\n\n**ข้อมูลเพิ่มเติม/โปรโมชั่นพิเศษ:**\n';
            prompt += trainingData;
        }

        return prompt;
    }

    // Generate response from AI
    async generateResponse(userMessage, conversationContext = [], retryCount = 0) {
        if (!this.hasApiKey()) {
            throw new Error('กรุณาตั้งค่า API Key ก่อนใช้งาน');
        }

        const provider = this.getProvider();
        const maxRetries = this.getAllApiKeys().length; // Maximum retries = number of keys

        try {
            let response;

            switch (provider) {
                case 'groq':
                    response = await this.callGroq(userMessage, conversationContext);
                    break;
                case 'gemini':
                    response = await this.callGemini(userMessage, conversationContext);
                    break;
                case 'cohere':
                    response = await this.callCohere(userMessage, conversationContext);
                    break;
                case 'huggingface':
                    response = await this.callHuggingFace(userMessage, conversationContext);
                    break;
                default:
                    throw new Error('Invalid AI provider');
            }

            // Detect lead capture
            const leadInfo = this.detectLeadCapture(userMessage, response);

            return {
                text: this.normalizeResponse(response),
                hasLead: leadInfo.hasLead,
                leadType: leadInfo.leadType
            };

        } catch (error) {
            // Check if it's a rate limit error
            const isRateLimit = error.message && (
                error.message.includes('Rate limit') ||
                error.message.includes('rate_limit') ||
                error.message.includes('429') ||
                error.message.includes('quota')
            );

            if (isRateLimit && retryCount < maxRetries) {
                const allKeys = this.getAllApiKeys();

                if (allKeys.length > 1) {
                    console.log(`🔄 Rate limit - trying next API key (${retryCount + 1}/${maxRetries})...`);

                    if (this.rotateApiKey()) {
                        console.log('✅ Retrying with next key...');
                        return await this.generateResponse(userMessage, conversationContext, retryCount + 1);
                    }
                }
            }

            // All keys exhausted or other error
            if (isRateLimit) {
                throw new Error(`❌ Rate limit reached. All ${this.getAllApiKeys().length} API keys are exhausted. Please try again later or switch to a different AI provider in Settings.`);
            }

            throw error;
        }
    }

    // Groq API (Recommended - Fast & Free)
    async callGroq(userMessage, conversationContext) {
        const messages = [
            { role: 'system', content: this.buildFocusedPrompt() },
            ...conversationContext.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            })),
            { role: 'user', content: userMessage }
        ];

        const response = await fetch(this.endpoints.groq, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getApiKey()}`
            },
            body: JSON.stringify({
                model: this.models.groq,
                messages: messages,
                temperature: 0.7,
                max_tokens: 1024,
                top_p: 0.95
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Groq API Error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || 'ขออภัยค่ะ ไม่สามารถประมวลผลได้ในขณะนี้';
    }

    // Gemini API (Backup)
    async callGemini(userMessage, conversationContext) {
        const messages = [];

        messages.push({
            role: 'user',
            parts: [{ text: this.buildFocusedPrompt() }]
        });

        messages.push({
            role: 'model',
            parts: [{ text: 'เข้าใจค่ะ ฉันพร้อมช่วยเหลือในฐานะที่ปรึกษาประกันชีวิตของไทยประกันชีวิตค่ะ 😊' }]
        });

        conversationContext.forEach(msg => {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        });

        messages.push({
            role: 'user',
            parts: [{ text: userMessage }]
        });

        const response = await fetch(`${this.endpoints.gemini}?key=${this.getApiKey()}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: messages,
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API Error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.candidates[0]?.content?.parts[0]?.text || 'ขออภัยค่ะ ไม่สามารถประมวลผลได้ในขณะนี้';
    }

    // Cohere API (Alternative)
    async callCohere(userMessage, conversationContext) {
        const chatHistory = conversationContext.map(msg => ({
            role: msg.role === 'user' ? 'USER' : 'CHATBOT',
            message: msg.content
        }));

        const response = await fetch(this.endpoints.cohere, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getApiKey()}`
            },
            body: JSON.stringify({
                model: this.models.cohere,
                message: userMessage,
                chat_history: chatHistory,
                preamble: this.buildFocusedPrompt(),
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Cohere API Error: ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        return data.text || 'ขออภัยค่ะ ไม่สามารถประมวลผลได้ในขณะนี้';
    }

    // Hugging Face API (Alternative)
    async callHuggingFace(userMessage, conversationContext) {
        // Build conversation
        let conversation = this.buildFocusedPrompt() + '\n\n';
        conversationContext.forEach(msg => {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            conversation += `${role}: ${msg.content}\n\n`;
        });
        conversation += `User: ${userMessage}\n\nAssistant:`;

        const response = await fetch(this.endpoints.huggingface, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getApiKey()}`
            },
            body: JSON.stringify({
                inputs: conversation,
                parameters: {
                    max_new_tokens: 1024,
                    temperature: 0.7,
                    top_p: 0.95,
                    return_full_text: false
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HuggingFace API Error: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        return data[0]?.generated_text || 'ขออภัยค่ะ ไม่สามารถประมวลผลได้ในขณะนี้';
    }

    // Detect lead capture in conversation
    detectLeadCapture(userMessage, aiResponse) {
        const hasLead = aiResponse.toLowerCase().includes('เบอร์โทร') ||
            aiResponse.toLowerCase().includes('ฝากเบอร์') ||
            aiResponse.toLowerCase().includes('phone') ||
            aiResponse.toLowerCase().includes('contact');

        let leadType = 'none';
        if (hasLead) {
            leadType = 'phone_request';
        }

        return {
            hasLead: hasLead,
            leadType: leadType
        };
    }


    // Calculate premium (helper method)
    calculatePremium(age, gender, sumAssured, paymentYears) {
        return PREMIUM_CALCULATOR.calculatePremium(age, gender, sumAssured, paymentYears);
    }

    // Get product info
    getProductInfo(productCode) {
        return Object.values(INSURANCE_PRODUCTS).find(p => p.code === productCode);
    }

    // Get all products
    getAllProducts() {
        return Object.values(INSURANCE_PRODUCTS);
    }

    // Clear conversation history
    clearHistory() {
        this.conversationHistory = [];
    }

    // Normalize response format
    normalizeResponse(text) {
        if (!text) return text;

        let normalized = text;

        // 1. Collapse multiple newlines/spaces into single newline
        // effectively removes blank lines
        normalized = normalized.replace(/\n\s*\n/g, '\n');

        // 2. Ensure dots have newlines around them
        // If there is a dot on a line by itself (or with spaces), make sure it has \n around it
        // However, step 1 already collapsed everything to \n.\n if there were blank lines.

        // Scenario: "Text\n.\nText" -> Keep
        // Scenario: "Text\n\n.\n\nText" -> "Text\n.\nText" (handled by step 1) gets "Text\n.\nText" matches 

        // Let's also enforce that there are NO double newlines at all.
        // The user wants:
        // xxx
        // .
        // xxx

        // If the AI somehow outputs:
        // xxx
        //
        // .
        // 
        // xxx

        // Step 1: `replace(/\n\s*\n/g, '\n')` turns it into:
        // xxx
        // .
        // xxx

        // Which is exactly what we want.

        // Also trim start/end
        normalized = normalized.trim();

        return normalized;
    }
}

// Export singleton instance
export default new AIService();

// Test Code
const test = "Line 1


.

Line 2";
console.log(JSON.stringify(new AIService().normalizeResponse(test)));
