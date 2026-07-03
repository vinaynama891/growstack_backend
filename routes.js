const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Admin, Service, Lead, Project } = require('./models');
const { verifyAdminToken, JWT_SECRET } = require('./auth');
const imagekit = require('./imagekit');

const router = express.Router();

// --- AUTH ROUTE ---
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: admin._id, email: admin.email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, email: admin.email });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// --- PUBLIC LEAD SUBMISSION ---
router.post('/leads', async (req, res) => {
  const { name, contactNumber, businessName } = req.body;
  if (!name || !contactNumber || !businessName) {
    return res.status(400).json({ message: 'Name, contact number, and business name are required.' });
  }

  try {
    const newLead = new Lead({ name, contactNumber, businessName });
    await newLead.save();
    return res.status(201).json({ message: 'Details submitted successfully!', lead: newLead });
  } catch (error) {
    console.error('Lead submission error:', error);
    return res.status(500).json({ message: 'Failed to submit details. Please try again.' });
  }
});

// --- ADMIN SECURE LEADS LIST ---
router.get('/admin/leads', verifyAdminToken, async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 });
    return res.json(leads);
  } catch (error) {
    console.error('Fetch leads error:', error);
    return res.status(500).json({ message: 'Failed to fetch leads.' });
  }
});

router.put('/admin/leads/:id', verifyAdminToken, async (req, res) => {
  const { status, requirements } = req.body;
  try {
    const updatedLead = await Lead.findByIdAndUpdate(
      req.params.id,
      { status, requirements },
      { new: true, runValidators: true }
    );
    if (!updatedLead) {
      return res.status(404).json({ message: 'Lead not found.' });
    }
    return res.json({ message: 'Lead updated successfully!', lead: updatedLead });
  } catch (error) {
    console.error('Update lead error:', error);
    return res.status(500).json({ message: 'Failed to update lead.' });
  }
});

// --- SERVICES PUBLIC LIST ---
router.get('/services', async (req, res) => {
  try {
    const services = await Service.find().sort({ order: 1 });
    return res.json(services);
  } catch (error) {
    console.error('Fetch services error:', error);
    return res.status(500).json({ message: 'Failed to fetch services.' });
  }
});

// --- ADMIN SECURE SERVICES CRUD ---
router.post('/admin/services', verifyAdminToken, async (req, res) => {
  const { title, description, icon, order } = req.body;
  if (!title || !description) {
    return res.status(400).json({ message: 'Title and description are required.' });
  }

  try {
    const newService = new Service({ title, description, icon, order: order || 0 });
    await newService.save();
    return res.status(201).json({ message: 'Service created successfully!', service: newService });
  } catch (error) {
    console.error('Create service error:', error);
    return res.status(500).json({ message: 'Failed to create service.' });
  }
});

router.put('/admin/services/:id', verifyAdminToken, async (req, res) => {
  const { title, description, icon, order } = req.body;
  try {
    const updatedService = await Service.findByIdAndUpdate(
      req.params.id,
      { title, description, icon, order },
      { new: true, runValidators: true }
    );
    if (!updatedService) {
      return res.status(404).json({ message: 'Service not found.' });
    }
    return res.json({ message: 'Service updated successfully!', service: updatedService });
  } catch (error) {
    console.error('Update service error:', error);
    return res.status(500).json({ message: 'Failed to update service.' });
  }
});

router.delete('/admin/services/:id', verifyAdminToken, async (req, res) => {
  try {
    const deletedService = await Service.findByIdAndDelete(req.params.id);
    if (!deletedService) {
      return res.status(404).json({ message: 'Service not found.' });
    }
    return res.json({ message: 'Service deleted successfully!' });
  } catch (error) {
    console.error('Delete service error:', error);
    return res.status(500).json({ message: 'Failed to delete service.' });
  }
});

// --- PROJECTS PUBLIC LIST ---
router.get('/projects', async (req, res) => {
  try {
    const projects = await Project.find().sort({ order: 1, createdAt: -1 });
    return res.json(projects);
  } catch (error) {
    console.error('Fetch projects error:', error);
    return res.status(500).json({ message: 'Failed to fetch projects.' });
  }
});

// --- ADMIN SECURE PROJECTS CRUD ---
router.post('/admin/projects', verifyAdminToken, async (req, res) => {
  const { title, description, projectUrl, order, imageUrl } = req.body;
  if (!title || !description || !projectUrl) {
    return res.status(400).json({ message: 'Title, description, and website URL are required.' });
  }

  let finalImageUrl = imageUrl || '';
  if (imageUrl && imageUrl.startsWith('data:')) {
    if (!imagekit) {
      return res.status(400).json({ message: 'ImageKit credentials are not configured on the server.' });
    }
    try {
      const uploadResponse = await imagekit.files.upload({
        file: imageUrl,
        fileName: `project_${Date.now()}.png`
      });
      finalImageUrl = uploadResponse.url;
    } catch (uploadError) {
      console.error('ImageKit upload error:', uploadError);
      return res.status(500).json({ message: 'Failed to upload image to ImageKit.' });
    }
  }

  try {
    const newProject = new Project({ title, description, projectUrl, order: order || 0, imageUrl: finalImageUrl });
    await newProject.save();
    return res.status(201).json({ message: 'Project created successfully!', project: newProject });
  } catch (error) {
    console.error('Create project error:', error);
    return res.status(500).json({ message: 'Failed to create project.' });
  }
});

router.put('/admin/projects/:id', verifyAdminToken, async (req, res) => {
  const { title, description, projectUrl, order, imageUrl } = req.body;
  
  let finalImageUrl = imageUrl;
  if (imageUrl && imageUrl.startsWith('data:')) {
    if (!imagekit) {
      return res.status(400).json({ message: 'ImageKit credentials are not configured on the server.' });
    }
    try {
      const uploadResponse = await imagekit.files.upload({
        file: imageUrl,
        fileName: `project_${Date.now()}.png`
      });
      finalImageUrl = uploadResponse.url;
    } catch (uploadError) {
      console.error('ImageKit upload error:', uploadError);
      return res.status(500).json({ message: 'Failed to upload image to ImageKit.' });
    }
  }

  try {
    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      { title, description, projectUrl, order, imageUrl: finalImageUrl },
      { new: true, runValidators: true }
    );
    if (!updatedProject) {
      return res.status(404).json({ message: 'Project not found.' });
    }
    return res.json({ message: 'Project updated successfully!', project: updatedProject });
  } catch (error) {
    console.error('Update project error:', error);
    return res.status(500).json({ message: 'Failed to update project.' });
  }
});

router.delete('/admin/projects/:id', verifyAdminToken, async (req, res) => {
  try {
    const deletedProject = await Project.findByIdAndDelete(req.params.id);
    if (!deletedProject) {
      return res.status(404).json({ message: 'Project not found.' });
    }
    return res.json({ message: 'Project deleted successfully!' });
  } catch (error) {
    console.error('Delete project error:', error);
    return res.status(500).json({ message: 'Failed to delete project.' });
  }
});

module.exports = router;
