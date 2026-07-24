import { Router, Request, Response } from 'express';
import pool from '../config/db';

const router = Router();

// Get campaigns for organization from Postgres
router.get('/', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query;
    let query = 'SELECT id, title, description, slug, is_active FROM campaigns';
    const params: any[] = [];
    if (organizationId) {
      query += ' WHERE organization_id = $1';
      params.push(organizationId);
    }
    query += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(query, params);
    return res.status(200).json({ success: true, campaigns: rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get campaign publicly by slug (for the checkout widget embed)
router.get('/public/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.title, c.description, c.slug, c.form_fields, o.name AS "orgName", o.logo_url AS "logoUrl", o.primary_currency AS "currency"
       FROM campaigns c
       JOIN organizations o ON c.organization_id = o.id
       WHERE c.slug = $1 AND c.is_active = true`,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    return res.status(200).json({
      success: true,
      campaign: rows[0]
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Create new campaign
router.post('/', async (req: Request, res: Response) => {
  const { title, description, slug, formFields, organizationId } = req.body;
  try {
    const orgId = organizationId || 'f728c312-d961-460d-a3df-6a982f1b0cd9'; // Default WaterAid India Org fallback
    
    const query = `
      INSERT INTO campaigns (organization_id, title, description, slug, form_fields)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, title, slug, is_active
    `;
    
    const { rows } = await pool.query(query, [
      orgId,
      title,
      description || '',
      slug,
      JSON.stringify(formFields || [])
    ]);

    return res.status(201).json({
      success: true,
      message: 'Campaign created successfully!',
      campaign: rows[0]
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Update campaign
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, slug, is_active } = req.body;
  try {
    const query = `
      UPDATE campaigns 
      SET title = $1, description = $2, slug = $3, is_active = $4
      WHERE id = $5
      RETURNING id, title, slug, is_active
    `;
    const { rows } = await pool.query(query, [title, description, slug, is_active, id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }
    return res.status(200).json({ success: true, message: 'Campaign updated successfully!', campaign: rows[0] });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Delete campaign
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM campaigns WHERE id = $1', [id]);
    return res.status(200).json({ success: true, message: 'Campaign deleted successfully!' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
