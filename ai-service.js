// Multi-AI Service - Support for multiple AI providers
import { SYSTEM_PROMPT, COMMENT_SYSTEM_PROMPT, INBOX_SYSTEM_PROMPT, INSURANCE_PRODUCTS, PREMIUM_CALCULATOR, AD_COPY_VARIANTS } from './knowledge-base.js?v=9';

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

    // Get current API key (with expiry check)
    getApiKey() {
        const provider = this.getProvider();
        const keysJson = localStorage.getItem(`${provider}_api_key`);

        if (!keysJson) return null;

        // Check expiry time
        const expiryTime = parseInt(localStorage.getItem('admin_api_expiry') || '0');
        if (expiryTime > 0 && Date.now() > expiryTime) {
            console.warn('⚠️ API Key หมดอายุแล้ว กรุณาให้ Admin กรอกใหม่');
            return null;
        }

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

    // Set response mode (comment or inbox)
    setResponseMode(mode) {
        localStorage.setItem('response_mode', mode);
    }

    // Get response mode
    getResponseMode() {
        return localStorage.getItem('response_mode') || 'comment'; // default: comment
    }

    // Helper: Select weighted ad copy variant
    selectAdCopyVariant(productKey) {
        if (!AD_COPY_VARIANTS[productKey]) return null;

        const variants = AD_COPY_VARIANTS[productKey].variants;
        const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
        let random = Math.random() * totalWeight;

        for (const variant of variants) {
            random -= variant.weight;
            if (random <= 0) {
                return variant;
            }
        }
        return variants[variants.length - 1];
    }

    // Helper: Extract age from text
    extractAge(text) {
        if (!text) return null;

        // Regex patterns for Thai age context
        const patterns = [
            /อายุ\s*(\d{1,3})/,          // อายุ 60
            /วัย\s*(\d{1,3})/,           // วัย 60
            /(\d{1,3})\s*ปี/,            // 60 ปี
            /(\d{1,3})\s*ขวบ/            // 5 ขวบ
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const age = parseInt(match[1]);
                // Basic validation: age should be reasonable (e.g. 0-120)
                if (age >= 0 && age <= 120) {
                    return age;
                }
            }
        }
        return null;
    }

    // Build focused system prompt
    buildFocusedPrompt(userMessage = '') {
        const focusedProducts = this.getProductFocus();
        const trainingData = this.getProductTraining();
        const userAge = this.extractAge(userMessage);

        // 1. Determine which System Prompt to use
        // Comment Mode only when 'all' is selected (not specific products)
        let isCommentMode = false;
        let selectedVariant = null;

        // Only use Comment Mode when "all" is selected
        if (focusedProducts.includes('all')) {
            selectedVariant = this.selectAdCopyVariant('seniorCare');
            if (selectedVariant) {
                isCommentMode = true;
            }
        }

        // 2. Select Base Prompt based on response mode
        const responseMode = this.getResponseMode();
        let prompt;

        if (responseMode === 'inbox') {
            prompt = INBOX_SYSTEM_PROMPT;
        } else {
            // Comment mode (default)
            prompt = isCommentMode ? COMMENT_SYSTEM_PROMPT : SYSTEM_PROMPT;
        }

        // Get custom products from localStorage
        const customProducts = JSON.parse(localStorage.getItem('custom_products') || '[]');

        // If specific products are selected (not "all")
        if (!focusedProducts.includes('all')) {
            const selectedProducts = Object.values(INSURANCE_PRODUCTS)
                .filter(p => focusedProducts.includes(p.code));

            // --- AGE FILTERING CHECK ---
            let ineligibleProduct = null;
            let recommendedProduct = null;

            if (userAge !== null && selectedProducts.length === 1) {
                const product = selectedProducts[0];
                const { min, max } = product.ageRange;

                if (userAge < min || userAge > max) {
                    ineligibleProduct = product;

                    // Find alternative product
                    const allProducts = Object.values(INSURANCE_PRODUCTS);
                    recommendedProduct = allProducts.find(p =>
                        p.code !== product.code &&
                        userAge >= p.ageRange.min &&
                        userAge <= p.ageRange.max
                    );
                }
            }

            // CRITICAL: Override with conservative prompt OR Age Ineligible Prompt
            prompt = '';

            prompt += '=== กฎสำคัญที่สุด (ห้ามละเมิด!) ===\\n';
            prompt += 'คุณคือแอดมินเพจไทยประกันชีวิต (เพศหญิง) ลงท้ายด้วย ค่ะ\\n\\n';

            prompt += '=== ข้อห้ามเด็ดขาด ===\\n';
            prompt += '- ห้ามใส่ตัวเลขทุกชนิด (เบี้ย, ทุน, %, อายุ)\\n';
            prompt += '- ห้ามบอกว่า "สมัครได้" หรือ "สมัครไม่ได้"\\n';
            prompt += '- ห้ามใช้คำว่า "รับประกัน", "ได้แน่นอน"\\n';
            prompt += '- ห้ามใช้ภาษาอื่นนอกจากภาษาไทย\\n\\n';

            if (ineligibleProduct) {
                // --- SPECIAL PROMPT FOR INELIGIBLE AGE ---
                prompt += `🚨 **สถานการณ์พิเศษ: ลูกค้าอายุ ${userAge} ปี (เกินเกณฑ์ ${ineligibleProduct.name})** 🚨\\n\\n`;
                prompt += `แผน "${ineligibleProduct.name}" รับประกันที่อายุ ${ineligibleProduct.ageRange.min}-${ineligibleProduct.ageRange.max} ปีเท่านั้น\\n`;

                if (recommendedProduct) {
                    prompt += `✅ **สิ่งที่คุณต้องทำ:**\\n`;
                    prompt += `1. แจ้งอย่างสุภาพว่าแผนนี้อาจจะไม่ตรงตามเงื่อนไขอายุ\\n`;
                    prompt += `2. **แนะนำแผน "${recommendedProduct.name}" แทนทันที**\\n`;
                    prompt += `3. ให้ลิงก์ของ "${recommendedProduct.name}": ${recommendedProduct.url}\\n\\n`;

                    prompt += `**ตัวอย่างการตอบ:**\\n`;
                    prompt += `"สำหรับแผน ${ineligibleProduct.name} จะมีเงื่อนไขด้านอายุอยู่นิดนึงค่ะ\\n.\\n`;
                    prompt += `สำหรับพี่อายุ ${userAge} ปี ขอแนะนำเป็นแผน **${recommendedProduct.name}** แทนนะคะ แผนนี้เหมาะมากเลยค่ะ\\n.\\n`;
                    prompt += `สนใจดูรายละเอียดตรงนี้ได้เลยค่ะ\\n.\\n`;
                    prompt += `${recommendedProduct.url}\\n.\\n`;
                    prompt += `ฝากเบอร์โทรไว้ได้เลยนะคะ เดี๋ยวให้เจ้าหน้าที่ติดต่อกลับไปดูแลค่ะ 😊"\\n\\n`;
                } else {
                    // No alternative found
                    prompt += `✅ **สิ่งที่คุณต้องทำ:**\\n`;
                    prompt += `1. แจ้งอย่างสุภาพว่าแผนนี้อาจจะไม่ตรงตามเงื่อนไขอายุ\\n`;
                    prompt += `2. ขอเบอร์โทรเพื่อให้เจ้าหน้าที่ช่วยหาแบบประกันที่เหมาะสมที่สุดให้\\n\\n`;
                }
            } else {
                // --- NORMAL PRODUCT FOCUSED PROMPT (WARM & WELCOMING) ---
                prompt += '=== โปรดักส์ที่กำลังขาย ===\\n';
                selectedProducts.forEach(p => {
                    prompt += `🎯 **${p.name}**\\n`;
                    prompt += `   - ลิงก์: ${p.url}\\n`;
                });

                prompt += '\\n=== วิธีการตอบ (อบอุ่น เป็นกันเอง) ===\\n';
                prompt += '1. **เปิดด้วยการต้อนรับ** - ทักทายอบอุ่น แสดงความยินดีที่ลูกค้าสนใจ\\n';
                prompt += '2. **ตอบรับเบื้องต้น** - บอกว่าแผนนี้น่าสนใจ เหมาะสำหรับลูกค้า\\n';
                prompt += '3. **แนะนำกดลิงก์** - เชิญชวนดูรายละเอียด\\n';
                prompt += '4. **ขอเบอร์โทร** - ขอเบอร์อย่างเป็นกันเอง\\n\\n';

                if (userAge !== null) {
                    prompt += `💡 **ลูกค้าบอกอายุมาแล้ว (${userAge} ปี)** - ตอบให้เฉพาะเจาะจง\\n\\n`;
                    prompt += '**ตัวอย่างการตอบ:**\\n';
                    prompt += `"สวัสดีค่ะ ยินดีให้ข้อมูลเลยค่ะ 😊\\n.\\n`;
                    prompt += `แผน ${selectedProducts[0]?.name || 'นี้'} เหมาะสำหรับพี่เลยค่ะ น่าสนใจมากๆ ค่ะ\\n.\\n`;
                    prompt += `สะดวกกดลิงก์นี้ดูรายละเอียดได้เลยนะคะ\\n.\\n`;
                    prompt += `${selectedProducts[0]?.url || '(ลิงก์)'}\\n.\\n`;
                    prompt += `ฝากเบอร์โทรไว้ได้ไหมคะ เดี๋ยวให้ที่ปรึกษาโทรไปอธิบายเพิ่มเติมให้ค่ะ ฟรีไม่มีค่าใช้จ่ายค่ะ 💚"\\n\\n`;
                } else {
                    prompt += '**ตัวอย่างการตอบ:**\\n';
                    prompt += `"สวัสดีค่ะ ยินดีให้ข้อมูลค่ะ 😊\\n.\\n`;
                    prompt += `แผน ${selectedProducts[0]?.name || 'นี้'} น่าสนใจมากเลยค่ะ\\n.\\n`;
                    prompt += `สะดวกกดลิงก์นี้ดูรายละเอียดได้เลยนะคะ\\n.\\n`;
                    prompt += `${selectedProducts[0]?.url || '(ลิงก์)'}\\n.\\n`;
                    prompt += `ถ้าสนใจ ฝากเบอร์โทรไว้ได้ไหมคะ เดี๋ยวให้ที่ปรึกษาโทรไปอธิบายเพิ่มเติมให้ค่ะ ฟรีไม่มีค่าใช้จ่ายค่ะ 💚"\\n\\n';
                }

                prompt += '=== กรณีอายุเกินเกณฑ์ ===\\n';
                prompt += 'แผนที่สอบถามจะมีเงื่อนไขด้านอายุค่ะ\\n';
                prompt += '.\\n';
                prompt += 'ในกรณีนี้ อาจมีแบบประกันอื่นที่เหมาะสมกว่าให้พิจารณา\\n';
                prompt += '.\\n';
                prompt += 'หากสนใจรับข้อมูลทางเลือกเพิ่มเติม สามารถกดลิงก์นี้ได้เลยค่ะ\\n';
                prompt += '.\\n';
                prompt += '(แนบลิงก์)\\n\\n';
            }

            prompt += '=== รูปแบบการตอบ ===\\n';
            prompt += '- เว้นบรรทัดด้วย . (จุด) ระหว่างย่อหน้า\\n';
            prompt += '- ลงท้ายด้วยการขอเบอร์โทรเสมอ\n';
        }

        // --- DYNAMIC AD COPY INJECTION ---
        if (isCommentMode && selectedVariant) {
            prompt += `\n\n **🎯 SELECTED AD COPY TEMPLATE:**\n`;
            prompt += `Please use the following text pattern to answer: \n`;
            prompt += `"${selectedVariant.template}"\n`;
        }

        // Add custom products (always include if exist)
        if (customProducts.length > 0) {
            prompt += '\n\n**โปรดักส์เพิ่มเติมที่มี:**\n';
            customProducts.forEach(p => {
                prompt += `\n### ${ p.name } \n`;
                prompt += `- อายุรับ: ${ p.ageRange } \n`;
                prompt += `- ความคุ้มครอง: ${ p.coverage } \n`;
                prompt += '- ประโยชน์:\n';
                p.benefits.forEach(b => {
                    prompt += `  * ${ b } \n`;
                });
            });
        }

        // Add custom training data
        if (trainingData && trainingData.trim()) {
            prompt += '\n\n**ข้อมูลเพิ่มเติม/โปรโมชั่นพิเศษ (ถ้ามีให้ใช้เสริม แต่ห้ามขัดกับ Ad Copy):**\n';
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
                    console.log(`🔄 Rate limit - trying next API key(${ retryCount + 1}/${maxRetries})...`);

                    if (this.rotateApiKey()) {
                        console.log('✅ Retrying with next key...');
                        return await this.generateResponse(userMessage, conversationContext, retryCount + 1);
                    }
                }
            }

            // If rate limit and all keys exhausted, try fallback to another provider
            if (isRateLimit) {
                const currentProvider = this.getProvider();
                const fallbackProvider = currentProvider === 'groq' ? 'gemini' : 'groq';

                // Check if fallback provider has keys
                const fallbackKeys = JSON.parse(localStorage.getItem(`${ fallbackProvider } _api_key`) || '[]');

                if (fallbackKeys.length > 0) {
                    console.log(`🔄 Switching to fallback provider: ${ fallbackProvider } `);
                    this.setProvider(fallbackProvider);
                    return await this.generateResponse(userMessage, conversationContext, 0);
                }

                throw new Error(`❌ Rate limit reached.กรุณารอสักครู่หรือเพิ่ม API Key ใหม่ในหน้า Admin`);
            }

            throw error;
        }
    }

    // Groq API (Recommended - Fast & Free)
    async callGroq(userMessage, conversationContext) {
        const messages = [
            { role: 'system', content: this.buildFocusedPrompt(userMessage) },
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
                'Authorization': `Bearer ${ this.getApiKey() } `
            },
            body: JSON.stringify({
                model: this.models.groq,
                messages: messages,
                temperature: 0.4,
                max_tokens: 1024,
                top_p: 0.9
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Groq API Error: ${ errorData.error?.message || response.statusText } `);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || 'ขออภัยค่ะ ไม่สามารถประมวลผลได้ในขณะนี้';
    }

    // Gemini API (Backup)
    async callGemini(userMessage, conversationContext) {
        const messages = [];

        messages.push({
            role: 'user',
            parts: [{ text: this.buildFocusedPrompt(userMessage) }]
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

        const response = await fetch(`${ this.endpoints.gemini }?key = ${ this.getApiKey() } `, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: messages,
                generationConfig: {
                    temperature: 0.4,
                    topK: 40,
                    topP: 0.9,
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API Error: ${ errorData.error?.message || response.statusText } `);
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
                'Authorization': `Bearer ${ this.getApiKey() } `
            },
            body: JSON.stringify({
                model: this.models.cohere,
                message: userMessage,
                chat_history: chatHistory,
                preamble: this.buildFocusedPrompt(userMessage),
                temperature: 0.4
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Cohere API Error: ${ errorData.message || response.statusText } `);
        }

        const data = await response.json();
        return data.text || 'ขออภัยค่ะ ไม่สามารถประมวลผลได้ในขณะนี้';
    }

    // Hugging Face API (Alternative)
    async callHuggingFace(userMessage, conversationContext) {
        // Build conversation
        let conversation = this.buildFocusedPrompt(userMessage) + '\n\n';
        conversationContext.forEach(msg => {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            conversation += `${ role }: ${ msg.content } \n\n`;
        });
        conversation += `User: ${ userMessage } \n\nAssistant: `;

        const response = await fetch(this.endpoints.huggingface, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ this.getApiKey() } `
            },
            body: JSON.stringify({
                inputs: conversation,
                parameters: {
                    max_new_tokens: 1024,
                    temperature: 0.4,
                    top_p: 0.9,
                    return_full_text: false
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HuggingFace API Error: ${ errorData.error || response.statusText } `);
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
        const DOT_PLACEHOLDER = '___DOT_PLACEHOLDER___';

        // 1. Protect existing dots
        // Find lines that are just a dot (with optional whitespace)
        normalized = normalized.replace(/(^|\n)\s*\.\s*(\n|$)/g, `$1${ DOT_PLACEHOLDER } $2`);

        // 2. Collapse multiple newlines around the placeholder
        // e.g. "\n\n___DOT___\n\n" -> "\n___DOT___\n"
        // We use a loop to ensure we catch all variations or a specific regex
        // Regex: At least one newline, optional whitespace, placeholder, optional whitespace, at least one newline
        const placeholderRegex = new RegExp(`\\n\\s * ${ DOT_PLACEHOLDER } \\s *\\n`, 'g');
        normalized = normalized.replace(placeholderRegex, `\n${ DOT_PLACEHOLDER } \n`);

        // Also handle start/end of string cases if needed, but the primary issue is middle content.

        // 3. Convert remaining "True Blank Lines" (double newlines) into placeholders
        // Meaning: Data\n\nData -> Data\n.\nData
        normalized = normalized.replace(/\n\s*\n/g, `\n${ DOT_PLACEHOLDER } \n`);

        // 4. Restore dots and ensure surrounding newlines
        // The placeholder is now guaranteed to be between newlines (from steps 2 & 3)
        // or at start/end.
        normalized = normalized.replace(new RegExp(DOT_PLACEHOLDER, 'g'), '.');

        // 5. Cleanup: Ensure we didn't create triple newlines or weird artifacts
        // This regex ensures we have exactly \n.\n where intended
        // But let's just do a final pass to be safe: 
        // collapse \n\n+ -> \n
        // normalized = normalized.replace(/\n{2,}/g, '\n'); 
        // Wait, NO. We want \n.\n. 
        // If step 3 gave \n.\n, we are good.

        // 6. Final Trim
        normalized = normalized.trim();

        return normalized;
    }
}

// Export singleton instance
export default new AIService();
