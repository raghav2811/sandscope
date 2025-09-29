// Supabase Configuration
// IMPORTANT: Replace these with your actual Supabase credentials
const SUPABASE_CONFIG = {
    url: 'https://dbhklkalmabfbeevkrak.supabase.co', // Your Supabase project URL
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiaGtsa2FsbWFiZmJlZXZrcmFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNTczNjUsImV4cCI6MjA3MzkzMzM2NX0.qKwD7kwrJxqxzflLBBeOW4LKMn8AfFR71DW0EhnYHEI', // Your Supabase anon key
    bucketName: 'images', // Name of your storage bucket
    tableName: 'uploads' // Name of your database table
};

// API Configuration
const API_CONFIG = {
    // Use environment-specific API URL
    baseUrl: window.location.hostname.includes('localhost') 
        ? 'http://localhost:8000'
        : 'https://sandscore-api.onrender.com', // Replace with your actual Render API URL
    endpoints: {
        analyze: '/analyze',
        status: '/status'
    }
};

// Application Configuration
const APP_CONFIG = {
    maxFileSize: 10 * 1024 * 1024, // 10MB in bytes
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxFiles: 10 // Maximum number of files that can be uploaded at once
};

// Export configurations for use in other files
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.API_CONFIG = API_CONFIG;
window.APP_CONFIG = APP_CONFIG;