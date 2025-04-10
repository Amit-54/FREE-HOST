const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const unzipper = require('unzipper');
const archiver = require('archiver');
const crypto = require('crypto');

const app = express();
const PORT = 5000;
const STORAGE_PATH = path.join(__dirname, 'storage');

// Create storage directory if not exists
if (!fs.existsSync(STORAGE_PATH)) {
  try {
    fs.mkdirSync(STORAGE_PATH, { recursive: true });
    console.log('Storage directory created');
  } catch (err) {
    console.error('Failed to create storage directory:', err);
    process.exit(1);
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/p', express.static(path.join(STORAGE_PATH, 'projects')));

// Configure file upload
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const projectDir = path.join(STORAGE_PATH, 'projects', req.body.projectId);
      if (!fs.existsSync(projectDir)) {
        try {
          fs.mkdirSync(projectDir, { recursive: true });
        } catch (err) {
          console.error('Failed to create project directory:', err);
          return cb(new Error('Failed to create project directory'));
        }
      }
      cb(null, projectDir);
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    success: false,
    error: err.message || 'Failed to create project' 
  });
});

// Generate project ID
function generateProjectId(username) {
  return `${username}-${crypto.randomBytes(4).toString('hex')}`;
}

// Create project endpoint
app.post('/api/projects', (req, res, next) => {
  try {
    const { username, projectName } = req.body;
    
    if (!username || !projectName) {
      throw new Error('Username and project name are required');
    }

    const projectId = generateProjectId(username);
    const projectDir = path.join(STORAGE_PATH, 'projects', projectId);

    if (fs.existsSync(projectDir)) {
      throw new Error('Project directory already exists');
    }

    fs.mkdirSync(projectDir, { recursive: true });
    
    res.json({
      success: true,
      projectId,
      publicUrl: `${req.protocol}://${req.get('host')}/p/${projectId}`
    });

  } catch (err) {
    next(new Error(`Failed to create project: ${err.message}`));
  }
});

// File upload endpoint
app.post('/api/upload', upload.array('files'), async (req, res, next) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    const projectDir = path.join(STORAGE_PATH, 'projects', projectId);
    
    if (!fs.existsSync(projectDir)) {
      throw new Error('Project does not exist');
    }

    // Process ZIP files
    await Promise.all(req.files.map(file => {
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
    }));

    res.json({ 
      success: true,
      message: 'Files uploaded successfully'
    });

  } catch (err) {
    next(new Error(`Failed to upload files: ${err.message}`));
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}).on('error', (err) => {
  console.error('Server failed to start:', err);
});
