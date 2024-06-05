const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const salt = bcrypt.genSaltSync(10);
const secret = 'tesdvqsdgazze12FA21R';
const uploadMiddleware = multer({ dest: 'uploads/' });

app.use(cors({ credentials: true, origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(cookieParser());

// Serve static files from the "uploads" directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect('mongodb+srv://belghithmohamedfiras:U5OduonobvMgxwFF@cluster0.dubwnl2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userDoc = await User.create({ username, password: bcrypt.hashSync(password, salt) });
        res.json(userDoc);
    } catch (e) {
        console.log(e);
        res.status(400).json(e);
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userDoc = await User.findOne({ username });
        if (!userDoc) {
            return res.status(400).json('Utilisateur non trouvé');
        }

        const passOK = bcrypt.compareSync(password, userDoc.password);
        if (passOK) {
            jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
                if (err) throw err;
                res.cookie('token', token).json({
                    id: userDoc._id,
                    username,
                });
            });
        } else {
            res.status(400).json('Identifiants incorrects');
        }
    } catch (e) {
        console.log(e);
        res.status(500).json('Erreur du serveur');
    }
});

app.get('/profile', (req, res) => {
    const { token } = req.cookies;
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) throw err;
        res.json(info);
    });
});

app.post('/logout', (req, res) => {
    res.cookie('token', '').json('ok');
});

app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
    const { originalname, path: tempPath } = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = `${tempPath}.${ext}`; // Création du nouveau chemin avec l'extension
    fs.renameSync(tempPath, newPath); // Renommer le fichier avec le nouveau chemin
  
    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;
        
        const { title, summary, content } = req.body;
        const postDoc = await Post.create({
            title,
            summary,
            content,
            cover: newPath,
            author: info.id,
        });
        res.json(postDoc);
    });
});

app.get('/post', async (req, res) => {
    const posts = await Post.find().populate('author', ['username']).sort({ createdAt: -1 }).limit(20);
    res.json(posts);
});

app.get('/post/:id', async (req, res) => {
    const { id } = req.params;
    const postDoc = await Post.findById(id).populate('author', ['username']);
    res.json(postDoc);
});

app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
    let newPath = null;
    if (req.file) {
        const { originalname, path: tempPath } = req.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        newPath = `${tempPath}.${ext}`;
        fs.renameSync(tempPath, newPath);
    }
  
    const { token } = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;
        const { id, title, summary, content } = req.body;
        const postDoc = await Post.findById(id);
        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
        if (!isAuthor) {
            return res.status(400).json('You are not the author');
        }
        postDoc.title = title;
        postDoc.summary = summary;
        postDoc.content = content;
        if (newPath) {
            postDoc.cover = newPath;
        }
        await postDoc.save();
        res.json(postDoc);
    });
});

app.delete('/post/:id', async (req, res) => {
    const { id } = req.params;
    const { token } = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) {
            res.status(401).json({ message: 'Unauthorized' });
        } else {
            try {
                const postDoc = await Post.findById(id);
                if (!postDoc) {
                    return res.status(404).json({ message: 'Post not found' });
                }
                // Vérifiez si l'utilisateur actuel est l'auteur de la publication
                if (postDoc.author.toString() !== info.id) {
                    return res.status(403).json({ message: 'Forbidden' });
                }
                // Utilisez la méthode remove pour supprimer le document
                await postDoc.deleteOne();
                res.json({ message: 'Post deleted successfully' });
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'Internal Server Error' });
            }
        }
    });
});


app.listen(4000, () => {
    console.log('Server started on port 4000');
});
