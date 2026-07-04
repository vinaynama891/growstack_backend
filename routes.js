const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Admin, Service, Lead, Project, Finance } = require('./models');
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

// --- FINANCE ROUTES ---

// GET all finance entries
router.get('/admin/finance', verifyAdminToken, async (req, res) => {
  try {
    const entries = await Finance.find().sort({ date: -1, createdAt: -1 });
    return res.json(entries);
  } catch (error) {
    console.error('Fetch finance error:', error);
    return res.status(500).json({ message: 'Failed to fetch finance records.' });
  }
});

// GET finance summary (totals + monthly + category breakdown)
router.get('/admin/finance/summary', verifyAdminToken, async (req, res) => {
  try {
    const entries = await Finance.find();

    let totalIncome = 0;   // effective = amount - discount
    let totalExpense = 0;
    const monthlyMap = {};
    const categoryMap = {};

    entries.forEach(entry => {
      const d = new Date(entry.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      const cat = entry.category || 'General';

      if (entry.type === 'income') {
        // Effective income = total amount minus discount
        const effectiveIncome = (entry.amount || 0) - (entry.discount || 0);
        totalIncome += effectiveIncome;
        if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { month: monthLabel, income: 0, expense: 0 };
        monthlyMap[monthKey].income += effectiveIncome;
        if (!categoryMap[cat]) categoryMap[cat] = { income: 0, expense: 0 };
        categoryMap[cat].income += effectiveIncome;
      } else {
        const expense = entry.amount || 0;
        totalExpense += expense;
        if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { month: monthLabel, income: 0, expense: 0 };
        monthlyMap[monthKey].expense += expense;
        if (!categoryMap[cat]) categoryMap[cat] = { income: 0, expense: 0 };
        categoryMap[cat].expense += expense;
      }
    });

    const monthly = Object.keys(monthlyMap)
      .sort()
      .slice(-6)
      .map(k => monthlyMap[k]);

    const categories = Object.keys(categoryMap).map(name => ({
      name,
      income: categoryMap[name].income,
      expense: categoryMap[name].expense
    }));

    return res.json({
      totalIncome,
      totalExpense,
      netPL: totalIncome - totalExpense,  // (income after discount) - expenses
      monthly,
      categories
    });
  } catch (error) {
    console.error('Finance summary error:', error);
    return res.status(500).json({ message: 'Failed to generate finance summary.' });
  }
});

// POST create finance entry
router.post('/admin/finance', verifyAdminToken, async (req, res) => {
  const { type, title, description, amount, discount, paid, pending, category, date } = req.body;
  if (!type || !title || amount === undefined || amount === null) {
    return res.status(400).json({ message: 'Type, title, and amount are required.' });
  }
  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ message: 'Type must be income or expense.' });
  }

  try {
    const totalAmount = parseFloat(amount) || 0;
    const discountVal = type === 'income' ? (parseFloat(discount) || 0) : 0;
    const paidVal = type === 'income' ? (parseFloat(paid) || 0) : 0;
    // Auto-calculate pending = total - discount - paid
    const pendingVal = type === 'income' ? Math.max(0, totalAmount - discountVal - paidVal) : 0;

    const entry = new Finance({
      type,
      title: title.trim(),
      description: description ? description.trim() : '',
      amount: totalAmount,
      discount: discountVal,
      paid: paidVal,
      pending: pendingVal,
      category: category ? category.trim() : 'General',
      date: date ? new Date(date) : new Date()
    });
    await entry.save();
    return res.status(201).json({ message: 'Finance entry created!', entry });
  } catch (error) {
    console.error('Create finance error:', error);
    return res.status(500).json({ message: 'Failed to create finance entry.' });
  }
});

// PUT update finance entry
router.put('/admin/finance/:id', verifyAdminToken, async (req, res) => {
  const { type, title, description, amount, discount, paid, pending, category, date } = req.body;
  try {
    const totalAmount = amount !== undefined ? parseFloat(amount) : undefined;
    const discountVal = type === 'income' && discount !== undefined ? parseFloat(discount) || 0 : 0;
    const paidVal = type === 'income' && paid !== undefined ? parseFloat(paid) || 0 : 0;
    const pendingVal = (totalAmount !== undefined && type === 'income')
      ? Math.max(0, totalAmount - discountVal - paidVal)
      : undefined;

    const updated = await Finance.findByIdAndUpdate(
      req.params.id,
      {
        type,
        title: title ? title.trim() : undefined,
        description: description !== undefined ? description.trim() : undefined,
        amount: totalAmount,
        discount: discountVal,
        paid: paidVal,
        pending: pendingVal,
        category: category ? category.trim() : 'General',
        date: date ? new Date(date) : undefined
      },
      { new: true, runValidators: true, omitUndefined: true }
    );
    if (!updated) return res.status(404).json({ message: 'Finance entry not found.' });
    return res.json({ message: 'Finance entry updated!', entry: updated });
  } catch (error) {
    console.error('Update finance error:', error);
    return res.status(500).json({ message: 'Failed to update finance entry.' });
  }
});

// DELETE finance entry
router.delete('/admin/finance/:id', verifyAdminToken, async (req, res) => {
  try {
    const deleted = await Finance.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Finance entry not found.' });
    return res.json({ message: 'Finance entry deleted!' });
  } catch (error) {
    console.error('Delete finance error:', error);
    return res.status(500).json({ message: 'Failed to delete finance entry.' });
  }
});

// POST add installment to an income entry
router.post('/admin/finance/:id/installment', verifyAdminToken, async (req, res) => {
  const { amount, date, note } = req.body;
  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ message: 'Installment amount is required and must be > 0.' });
  }

  try {
    const entry = await Finance.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Finance entry not found.' });
    if (entry.type !== 'income') {
      return res.status(400).json({ message: 'Installments are only for income entries.' });
    }

    // Add new installment
    entry.installments.push({
      amount: parseFloat(amount),
      date: date ? new Date(date) : new Date(),
      note: note ? note.trim() : ''
    });

    // Recalculate paid = sum of all installments
    const newPaid = entry.installments.reduce((sum, inst) => sum + inst.amount, 0);
    entry.paid = newPaid;

    // Recalculate pending = amount - discount - paid
    entry.pending = Math.max(0, entry.amount - (entry.discount || 0) - newPaid);

    await entry.save();
    return res.status(201).json({ message: 'Installment added!', entry });
  } catch (error) {
    console.error('Add installment error:', error);
    return res.status(500).json({ message: 'Failed to add installment.' });
  }
});

// DELETE a specific installment from an income entry
router.delete('/admin/finance/:id/installment/:instId', verifyAdminToken, async (req, res) => {
  try {
    const entry = await Finance.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Finance entry not found.' });

    entry.installments = entry.installments.filter(
      inst => inst._id.toString() !== req.params.instId
    );

    // Recalculate
    const newPaid = entry.installments.reduce((sum, inst) => sum + inst.amount, 0);
    entry.paid = newPaid;
    entry.pending = Math.max(0, entry.amount - (entry.discount || 0) - newPaid);

    await entry.save();
    return res.json({ message: 'Installment removed!', entry });
  } catch (error) {
    console.error('Delete installment error:', error);
    return res.status(500).json({ message: 'Failed to remove installment.' });
  }
});

module.exports = router;
