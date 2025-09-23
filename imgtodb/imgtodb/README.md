# Image Upload to Supabase

A modern web application for uploading images to Supabase with drag-and-drop functionality, upload history, and a responsive UI.

## Features

- 📤 **Multiple Upload Methods**: Click to upload or drag-and-drop
- 🎯 **Drag & Drop Interface**: Visual feedback for file dropping
- 🖼️ **Image Preview**: Preview selected images before upload
- 📊 **Upload Progress**: Real-time progress tracking
- ⏹️ **Cancel Upload**: Cancel ongoing uploads
- 📚 **Upload History**: View all previously uploaded images
- 📍 **Location Tracking**: Automatically capture and store upload location (with user permission)
- 📱 **Camera Integration**: Take photos directly from the app
- 🤖 **Automated Sensor Readings**: Hourly automated image capture with location data
- 🔗 **External Trigger System**: Database-triggered automatic photo capture via sensor_data table
- 🎨 **Responsive Design**: Works on desktop and mobile
- ⚡ **Supabase Integration**: Secure cloud storage and database
- 🕒 **Accurate Timestamps**: Proper timezone handling for upload times

## Setup Instructions

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Storage and create a new bucket named `images`
3. Set the bucket to public (or configure RLS policies as needed)
4. Go to SQL Editor and run this query to create the uploads table:

```sql
CREATE TABLE uploads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    latitude DECIMAL(10, 8) NULL,
    longitude DECIMAL(11, 8) NULL,
    location_accuracy DECIMAL(10, 2) NULL,
    location_timestamp TIMESTAMP WITH TIME ZONE NULL,
    capture_type VARCHAR(20) DEFAULT 'manual',
    trigger_id UUID NULL,
    sensor_id TEXT NULL
);

-- Create sensor_data table for external trigger system
CREATE TABLE sensor_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    button VARCHAR(3) NOT NULL CHECK (button IN ('yes', 'no')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE,
    sensor_id TEXT NULL,
    metadata JSONB NULL
);

-- Enable RLS (Row Level Security) if needed
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_data ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public access (adjust as needed for your use case)
CREATE POLICY "Public Access" ON uploads FOR ALL USING (true);
CREATE POLICY "Public Access" ON sensor_data FOR ALL USING (true);

-- If you already have the uploads table, add the missing columns:
-- ALTER TABLE uploads ADD COLUMN capture_type VARCHAR(20) DEFAULT 'manual';
-- ALTER TABLE uploads ADD COLUMN trigger_id UUID NULL;
-- ALTER TABLE uploads ADD COLUMN sensor_id TEXT NULL;
-- ALTER TABLE uploads ADD COLUMN latitude DECIMAL(10, 8) NULL;
-- ALTER TABLE uploads ADD COLUMN longitude DECIMAL(11, 8) NULL;
-- ALTER TABLE uploads ADD COLUMN location_accuracy DECIMAL(10, 2) NULL;
-- ALTER TABLE uploads ADD COLUMN location_timestamp TIMESTAMP WITH TIME ZONE NULL;
```

### 2. Configuration

1. Open `config.js`
2. Replace `YOUR_SUPABASE_URL` with your Supabase project URL
3. Replace `YOUR_SUPABASE_ANON_KEY` with your Supabase anon key

### 3. Running the Application

#### Option 1: Using Live Server (Recommended)

1. Install Node.js if you haven't already
2. Run: `npm install`
3. Run: `npm start`
4. Open http://localhost:3000 in your browser

#### Option 2: Simple HTTP Server

1. If you have Python installed:
   ```bash
   # Python 3
   python -m http.server 3000
   
   # Python 2
   python -m SimpleHTTPServer 3000
   ```

2. If you have Node.js installed:
   ```bash
   npx serve .
   ```

3. Open the provided URL in your browser

## File Structure

```
imgtodb/
├── index.html                    # Main HTML file
├── sensor.html                   # Automated sensor readings page
├── sensor-trigger.html           # External trigger system page
├── styles.css                    # CSS styles
├── config.js                     # Configuration file
├── supabase.js                   # Supabase client setup
├── upload.js                     # Upload functionality
├── history.js                    # Upload history functionality
├── camera.js                     # Camera functionality
├── geolocation.js                # Location services
├── location-ui.js                # Location UI management
├── sensor-manager.js             # Automated sensor readings manager
├── sensor-trigger-manager.js     # External trigger system manager
├── app.js                        # Main application logic
├── package.json                  # NPM dependencies
└── README.md                     # This file
```

## Usage

### 1. **Manual Upload** (Main Page)
   - Click "Choose Files" button or drag images onto the upload area
   - Location access is **required** for all uploads
   - Preview selected images
   - Click "Upload Images" to start uploading

### 2. **Camera Capture** (Main Page)
   - Click "Take Photo" button to open camera modal
   - Capture photo and upload with location data

### 3. **Automated Sensor Readings** (Sensor Page)
   - Click "Auto Sensor" button to access the automated capture system
   - Configure hourly intervals (1 hour, 30 minutes, 15 minutes, 5 minutes)
   - Start monitoring for automatic photo capture at set intervals
   - View real-time countdown and capture statistics

### 4. **External Trigger System** (Trigger System Page)
   - Click "Trigger System" button to access database-triggered captures
   - Start monitoring the `sensor_data` table for trigger signals
   - When a record with `button = 'yes'` is inserted, system automatically:
     - Detects the trigger signal
     - Captures a photo using device camera
     - Uploads with location data and trigger metadata
     - Marks the trigger as processed

### 5. **Upload History** (All Pages)
   - View all uploaded images with metadata
   - Click images to view full size with location info
   - Includes manual uploads, sensor captures, and triggered captures

### 6. **Cancel Upload**
   - Use "Cancel" button to clear selected files
   - Use "Cancel Upload" button to stop active uploads

### 7. **Testing the Trigger System**
   - Use the "Test Trigger" button to insert a test signal
   - Or manually insert into `sensor_data` table:
   ```sql
   INSERT INTO sensor_data (button, sensor_id) VALUES ('yes', 'external_sensor_01');
   ```

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Security Notes

- The current setup uses public bucket access for simplicity
- For production use, consider implementing:
  - Row Level Security (RLS) policies
  - User authentication
  - File type validation on the server
  - Rate limiting

## Troubleshooting

1. **CORS Issues**: Make sure your Supabase project allows requests from your domain
2. **Upload Fails**: Check your Supabase credentials and bucket permissions
3. **Images Not Loading**: Verify your storage bucket is public or has correct RLS policies

## License

MIT License - feel free to use this code for your projects!