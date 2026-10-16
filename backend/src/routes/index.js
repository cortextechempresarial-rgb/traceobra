const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const clientController = require('../controllers/clientController');
const projectController = require('../controllers/projectController');
const taskController = require('../controllers/taskController');
const financeController = require('../controllers/financeController');
const materialsController = require('../controllers/materialsController');
const suppliersController = require('../controllers/suppliersController');
const scheduleController = require('../controllers/scheduleController');
const mapController = require('../controllers/mapController');
const concreteController = require('../controllers/concreteController');
const authController = require('../controllers/authController');
const { requireAuth, requireRole, auditMutations } = require('../middleware/auth');
const { plantUpload } = require('../middleware/plantUpload');

const router = express.Router();

router.post('/login', authController.login);
router.use(requireAuth, auditMutations);
router.post('/register', requireAuth, requireRole('admin'), authController.register);
router.get('/me', authController.me);

router.get('/dashboard', dashboardController.getSummary);
router.get('/clients', clientController.getAll);
router.post('/clients', clientController.create);
router.get('/projects', projectController.getAll);
router.post('/projects', requireRole('admin'), projectController.create);
router.put('/projects/:id', requireRole('admin'), projectController.update);
router.get('/tasks', taskController.getAll);
router.post('/tasks', taskController.create);
router.get('/finance', financeController.getAll);
router.post('/finance', requireRole('admin'), financeController.create);
router.get('/materials', materialsController.getAll);
router.post('/materials', requireRole('admin'), materialsController.create);
router.get('/suppliers', suppliersController.getAll);
router.post('/suppliers', requireRole('admin'), suppliersController.create);
router.get('/schedule', scheduleController.getAll);
router.post('/schedule', requireRole('admin'), scheduleController.create);
router.get('/maps', mapController.getAll);
router.get('/subdivisions', mapController.getSubdivisions);
router.put('/subdivisions/:id/location', requireRole('admin'), mapController.updateSubdivisionLocation);
router.post('/maps', requireRole('admin'), mapController.create);
router.put('/maps/:id', requireRole('admin'), mapController.update);
router.post('/subdivisions', requireRole('admin'), plantUpload, mapController.createSubdivision);
router.get('/concrete-pours', concreteController.getAll);
router.post('/concrete-pours', requireRole('admin', 'engineer'), concreteController.create);
router.patch('/concrete-pours/:id/status', requireRole('admin', 'engineer'), concreteController.updateStatus);

module.exports = router;
