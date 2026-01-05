// Admin Service - API Key Management with Expiry
// Password: Weerachit@jay
// Recovery Email: en3kngb@gmail.com

class AdminService {
    constructor() {
        // Admin credentials (hashed for basic security)
        this.ADMIN_PASSWORD_HASH = this.hashPassword('Weerachit@jay');
        this.RECOVERY_EMAIL = 'en3kngb@gmail.com';

        // Storage keys
        this.STORAGE_KEYS = {
            API_KEY: 'admin_api_key',
            EXPIRY_TIME: 'admin_api_expiry',
            PROVIDER: 'ai_provider',
            SESSION: 'admin_session'
        };

        // Default expiry: 10 hours in milliseconds
        this.DEFAULT_EXPIRY_HOURS = 10;
    }

    // Simple hash function (not cryptographically secure, but good enough for client-side)
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    // Verify admin password
    verifyPassword(password) {
        const inputHash = this.hashPassword(password);
        return inputHash === this.ADMIN_PASSWORD_HASH;
    }

    // Check if admin is logged in (session valid for 1 hour)
    isLoggedIn() {
        const session = localStorage.getItem(this.STORAGE_KEYS.SESSION);
        if (!session) return false;

        const sessionData = JSON.parse(session);
        const now = Date.now();

        // Session valid for 1 hour
        if (now > sessionData.expiry) {
            this.logout();
            return false;
        }

        return true;
    }

    // Login admin
    login(password) {
        if (this.verifyPassword(password)) {
            const session = {
                loggedIn: true,
                expiry: Date.now() + (60 * 60 * 1000) // 1 hour session
            };
            localStorage.setItem(this.STORAGE_KEYS.SESSION, JSON.stringify(session));
            return true;
        }
        return false;
    }

    // Logout admin
    logout() {
        localStorage.removeItem(this.STORAGE_KEYS.SESSION);
    }

    // Set API key with expiry (default 10 hours)
    setApiKey(apiKey, expiryHours = this.DEFAULT_EXPIRY_HOURS) {
        const provider = localStorage.getItem(this.STORAGE_KEYS.PROVIDER) || 'groq';
        const expiryTime = Date.now() + (expiryHours * 60 * 60 * 1000);

        // Store API key as JSON array (for compatibility with existing system)
        const keys = apiKey.split('\n').map(k => k.trim()).filter(k => k.length > 0);
        localStorage.setItem(`${provider}_api_key`, JSON.stringify(keys));
        localStorage.setItem(`${provider}_key_index`, '0');

        // Store expiry time
        localStorage.setItem(this.STORAGE_KEYS.EXPIRY_TIME, expiryTime.toString());

        return {
            success: true,
            expiryTime: expiryTime,
            keysCount: keys.length
        };
    }

    // Get API key (returns null if expired)
    getApiKey() {
        const provider = localStorage.getItem(this.STORAGE_KEYS.PROVIDER) || 'groq';
        const expiryTime = parseInt(localStorage.getItem(this.STORAGE_KEYS.EXPIRY_TIME) || '0');
        const now = Date.now();

        // Check if expired
        if (expiryTime > 0 && now > expiryTime) {
            return { expired: true, key: null };
        }

        // Get API key
        const keysJson = localStorage.getItem(`${provider}_api_key`);
        if (!keysJson) return { expired: false, key: null };

        const keys = JSON.parse(keysJson);
        if (!Array.isArray(keys) || keys.length === 0) return { expired: false, key: null };

        const currentIndex = parseInt(localStorage.getItem(`${provider}_key_index`) || '0');
        return {
            expired: false,
            key: keys[currentIndex % keys.length],
            allKeys: keys
        };
    }

    // Get time remaining before expiry
    getTimeRemaining() {
        const expiryTime = parseInt(localStorage.getItem(this.STORAGE_KEYS.EXPIRY_TIME) || '0');
        const now = Date.now();

        if (expiryTime === 0) {
            return { valid: false, message: 'ยังไม่ได้ตั้งค่า API Key' };
        }

        const remaining = expiryTime - now;

        if (remaining <= 0) {
            return { valid: false, message: 'API Key หมดอายุแล้ว', expired: true };
        }

        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

        return {
            valid: true,
            hours: hours,
            minutes: minutes,
            message: `เหลือเวลา: ${hours} ชั่วโมง ${minutes} นาที`,
            expiryTime: expiryTime
        };
    }

    // Clear expired API key
    clearApiKey() {
        const provider = localStorage.getItem(this.STORAGE_KEYS.PROVIDER) || 'groq';
        localStorage.removeItem(`${provider}_api_key`);
        localStorage.removeItem(`${provider}_key_index`);
        localStorage.removeItem(this.STORAGE_KEYS.EXPIRY_TIME);
    }

    // Get provider
    getProvider() {
        return localStorage.getItem(this.STORAGE_KEYS.PROVIDER) || 'groq';
    }

    // Set provider
    setProvider(provider) {
        localStorage.setItem(this.STORAGE_KEYS.PROVIDER, provider);
    }

    // Format expiry time for display
    formatExpiryTime() {
        const expiryTime = parseInt(localStorage.getItem(this.STORAGE_KEYS.EXPIRY_TIME) || '0');
        if (expiryTime === 0) return 'ไม่มีข้อมูล';

        const date = new Date(expiryTime);
        return date.toLocaleString('th-TH', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Send recovery email via EmailJS
    // NOTE: Requires EmailJS setup
    async sendRecoveryEmail() {
        // EmailJS configuration (user needs to set this up)
        const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID'; // Replace after setup
        const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID'; // Replace after setup
        const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY'; // Replace after setup

        if (EMAILJS_SERVICE_ID === 'YOUR_SERVICE_ID') {
            return {
                success: false,
                message: 'ยังไม่ได้ตั้งค่า EmailJS กรุณาติดต่อ Admin หรือดูคู่มือการตั้งค่า',
                manualRecovery: true
            };
        }

        try {
            // Load EmailJS SDK if not loaded
            if (!window.emailjs) {
                await this.loadEmailJS();
            }

            const templateParams = {
                to_email: this.RECOVERY_EMAIL,
                admin_password: 'Weerachit@jay', // Send actual password
                recovery_time: new Date().toLocaleString('th-TH')
            };

            await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);

            return {
                success: true,
                message: `ส่งรหัสผ่านไปที่ ${this.RECOVERY_EMAIL} แล้ว`
            };
        } catch (error) {
            console.error('EmailJS Error:', error);
            return {
                success: false,
                message: 'ไม่สามารถส่ง Email ได้: ' + error.message
            };
        }
    }

    // Load EmailJS SDK dynamically
    loadEmailJS() {
        return new Promise((resolve, reject) => {
            if (window.emailjs) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
}

// Export singleton
const adminService = new AdminService();
export default adminService;
