const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const unzipper = require('unzipper');
const crypto = require('crypto');

const app = express();
const PORT = 5000;
const STORAGE_PATH = path.join(__dirname, 'storage');

// Enhanced JSON middleware with error handling
app.use(express.json({
  verify: (req, res, buf, encoding) => {
    try {
      JSON.parse(buf.toString('utf8'));
    } catch (e) {
      throw new Error('Invalid JSON received');
    }
  },
  limit: '10mb' // Set appropriate limit
}));

// Static files middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use('/p', express.static(path.join(STORAGE_PATH, 'projects')));

// Create storage directory if not exists
if (!fs.existsSync(STORAGE_PATH)) {
  fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

// Configure file upload
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const projectDir = path.join(STORAGE_PATH, 'projects', req.body.projectId);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }
      cb(null, projectDir);
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/html',
      'text/css',
      'application/javascript',
      'application/x-php',
      'application/x-python-code',
      'application/zip',
      'application/x-zip-compressed'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(400).json({ 
    success: false,
    error: err.message || 'Invalid request' 
  });
});

// Generate project ID
function generateProjectId(username) {
  return `${username}-${crypto.randomBytes(4).toString('hex')}`;
}

// Create project endpoint with proper JSON validation
app.post('/api/projects', (req, res) => {
  try {
    if (!req.is('application/json')) {
      throw new Error('Content-Type must be application/json');
    }

    const { username, projectName } = req.body;
    
    if (!username || typeof username !== 'string') {
      throw new Error('Valid username is required');
    }

    if (!projectName || typeof projectName !== 'string') {
      throw new Error('Valid project name is required');
    }

    const projectId = generateProjectId(username);
    const projectDir = path.join(STORAGE_PATH, 'projects', projectId);

    if (fs.existsSync(projectDir)) {
      throw new Error('Project already exists');
    }

    fs.mkdirSync(projectDir, { recursive: true });
    
    res.json({
      success: true,
      projectId,
      publicUrl: `${req.protocol}://${req.get('host')}/p/${projectId}`
    });

  } catch (err) {
    res.status(400).json({ 
      success: false,
      error: `Failed to create project: ${err.message}`
    });
  }
});

// File upload endpoint with proper error handling
app.post('/api/upload', (req, res, next) => {
  upload.array('files')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ 
        success: false,
        error: `File upload failed: ${err.message}`
      });
    }
    
    try {
      const { projectId } = req.body;
      
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      const projectDir = path.join(STORAGE_PATH, 'projects', projectId);
      
      if (!fs.existsSync(projectDir)) {
        throw new Error('Project does not exist');
      }

      // Process files
      Promise.all(req.files.map(file => {
        if (file.originalname.endsWith('.zip')) {
          return new Promise((resolve, reject) => {
            fs.createReadStream(file.path)
              .pipe(unzipper.Extract({ path: projectDir }))
              .on('close', () => {
                fs.unlinkSync(file.path);
                resolve();
              })
              .on('error', reject);
          });
        }
        return Promise.resolve();
      }))
      .then(() => {
        res.json({ 
          success: true,
          message: 'Files uploaded successfully'
        });
      })
      .catch(error => {
        throw error;
      });

    } catch (err) {
      res.status(400).json({ 
        success: false,
        error: `Failed to process files: ${err.message}`
      });
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
});
