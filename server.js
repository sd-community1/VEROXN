const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const REPOS_DIR = path.join(__dirname, 'repositories');

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
    secret: 'veroxn-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Ensure repositories directory exists
fs.ensureDirSync(REPOS_DIR);

// --- API Routes ---

// Get all repositories
app.get('/api/repos', async (req, res) => {
    try {
        const repos = await fs.readdir(REPOS_DIR);
        const repoData = await Promise.all(repos.map(async (repo) => {
            const stats = await fs.stat(path.join(REPOS_DIR, repo));
            return { name: repo, updatedAt: stats.mtime };
        }));
        res.json(repoData);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch repositories' });
    }
});

// Create new repository
app.post('/api/repos', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Repo name is required' });
    
    const repoPath = path.join(REPOS_DIR, name);
    if (await fs.pathExists(repoPath)) {
        return res.status(400).json({ error: 'Repository already exists' });
    }

    try {
        await fs.ensureDir(repoPath);
        res.json({ success: true, name });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create repository' });
    }
});

// Get files in a repository
app.get('/api/repos/:name/files', async (req, res) => {
    const repoPath = path.join(REPOS_DIR, req.params.name);
    const subPath = req.query.path || '';
    const targetPath = path.join(repoPath, subPath);

    try {
        if (!(await fs.pathExists(targetPath))) return res.status(404).json({ error: 'Path not found' });
        
        const items = await fs.readdir(targetPath);
        const fileData = await Promise.all(items.map(async (item) => {
            const stats = await fs.stat(path.join(targetPath, item));
            return {
                name: item,
                isDirectory: stats.isDirectory(),
                size: stats.size,
                updatedAt: stats.mtime
            };
        }));
        res.json(fileData);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch files' });
    }
});

// Create/Update file
app.post('/api/repos/:name/files', async (req, res) => {
    const { filePath, content } = req.body;
    const fullPath = path.join(REPOS_DIR, req.params.name, filePath);

    try {
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, content || '');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save file' });
    }
});

// Read file content
app.get('/api/repos/:name/raw', async (req, res) => {
    const filePath = req.query.path;
    const fullPath = path.join(REPOS_DIR, req.params.name, filePath);

    try {
        if (!(await fs.pathExists(fullPath))) return res.status(404).send('File not found');
        const content = await fs.readFile(fullPath, 'utf-8');
        res.send(content);
    } catch (err) {
        res.status(500).send('Error reading file');
    }
});

// VEROXN Pages Simulation
app.get('/pages/:user/:repo/*', async (req, res) => {
    const { user, repo } = req.params;
    const filePath = req.params[0] || 'index.html';
    const fullPath = path.join(REPOS_DIR, repo, filePath);

    try {
        if (await fs.pathExists(fullPath)) {
            res.sendFile(fullPath);
        } else {
            res.status(404).send('Page not found in VEROXN Pages');
        }
    } catch (err) {
        res.status(500).send('Error serving page');
    }
});

// Delete Repo/File
app.delete('/api/repos/:name', async (req, res) => {
    const filePath = req.query.path;
    const targetPath = filePath ? path.join(REPOS_DIR, req.params.name, filePath) : path.join(REPOS_DIR, req.params.name);

    try {
        await fs.remove(targetPath);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`VEROXN Server running on http://localhost:${PORT}`);
});
