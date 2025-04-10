const { IncomingForm } = require('formidable');
const { promises: fs } = require('fs');
const unzipper = require('unzipper');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const form = new IncomingForm();
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve([fields, files]);
      });
    });

    const projectId = fields.projectId;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Process files
    const fileList = Array.isArray(files.files) ? files.files : [files.files];
    
    for (const file of fileList) {
      if (file.originalFilename.endsWith('.zip')) {
        await fs.promises.createReadStream(file.filepath)
          .pipe(unzipper.Extract({ path: `/tmp/${projectId}` ))
          .promise();
      } else {
        await fs.promises.rename(
          file.filepath,
          `/tmp/${projectId}/${file.originalFilename}`
        );
      }
    }

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ 
      error: err.message || 'Failed to upload files' 
    });
  }
};
