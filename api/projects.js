const { v4: uuidv4 } = require('uuid');

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

    const { username, projectName } = JSON.parse(req.body);
    
    if (!username || !projectName) {
      return res.status(400).json({ error: 'Username and project name are required' });
    }

    const projectId = `${username}-${uuidv4()}`;
    
    res.json({
      success: true,
      projectId,
      publicUrl: `${process.env.VERCEL_URL}/p/${projectId}`
    });

  } catch (err) {
    res.status(400).json({ 
      error: err.message || 'Failed to create project' 
    });
  }
};
