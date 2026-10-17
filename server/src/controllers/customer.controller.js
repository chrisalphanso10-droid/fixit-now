/**
 * FixIt Now - Customer Controller
 * Conforms to docs/SRS.md FR-C8 (Editable Profile) and FR-C9 (Saved Addresses).
 */

import { query } from '../config/db.js';
import { geocodeAddress } from '../services/geocoding.service.js';

/**
 * 1. Get Customer Profile (SRS FR-C8)
 */
export async function getCustomerProfile(req, res, next) {
  try {
    const customerId = req.user.id;

    const result = await query(
      `SELECT id, name, email, phone, address, latitude, longitude, photo_url, created_at, updated_at
       FROM customers
       WHERE id = $1`,
      [customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Customer record not found.' });
    }

    return res.status(200).json({
      status: 'success',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 2. Update Customer Profile (SRS FR-C8)
 */
export async function updateCustomerProfile(req, res, next) {
  try {
    const customerId = req.user.id;
    const { name, phone, address } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Full name is required.' });
    }
    if (!phone?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Phone number is required.' });
    }
    if (!address?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Street address is required.' });
    }

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanAddress = address.trim();

    // Check existing customer
    const existing = await query('SELECT address, latitude, longitude FROM customers WHERE id = $1', [
      customerId,
    ]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Customer record not found.' });
    }

    let lat = existing.rows[0].latitude;
    let lon = existing.rows[0].longitude;

    // If address changed or coordinates missing, geocode address
    if (cleanAddress !== existing.rows[0].address || lat == null || lon == null) {
      const geo = await geocodeAddress(cleanAddress);
      lat = geo.latitude;
      lon = geo.longitude;
    }

    const updateResult = await query(
      `UPDATE customers
       SET name = $1, phone = $2, address = $3, latitude = $4, longitude = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, name, email, phone, address, latitude, longitude, photo_url, updated_at`,
      [cleanName, cleanPhone, cleanAddress, lat, lon, customerId]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully.',
      data: updateResult.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 3. Get Saved Addresses (SRS FR-C9)
 */
export async function getSavedAddresses(req, res, next) {
  try {
    const customerId = req.user.id;

    const result = await query(
      `SELECT id, customer_id, label, address, latitude, longitude, is_default, created_at
       FROM saved_addresses
       WHERE customer_id = $1
       ORDER BY is_default DESC, id DESC`,
      [customerId]
    );

    return res.status(200).json({
      status: 'success',
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 4. Add Saved Address (SRS FR-C9)
 */
export async function addSavedAddress(req, res, next) {
  try {
    const customerId = req.user.id;
    const { label, address, is_default, latitude, longitude } = req.body;

    if (!label?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Address label (e.g. Home, Office) is required.' });
    }
    if (!address?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Street address is required.' });
    }

    const cleanLabel = label.trim();
    const cleanAddress = address.trim();
    const shouldBeDefault = Boolean(is_default);

    let lat = latitude != null ? Number(latitude) : null;
    let lon = longitude != null ? Number(longitude) : null;

    if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) {
      const geo = await geocodeAddress(cleanAddress);
      lat = geo.latitude;
      lon = geo.longitude;
    }

    if (shouldBeDefault) {
      await query(
        'UPDATE saved_addresses SET is_default = false WHERE customer_id = $1',
        [customerId]
      );
    }

    const result = await query(
      `INSERT INTO saved_addresses (customer_id, label, address, latitude, longitude, is_default)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, customer_id, label, address, latitude, longitude, is_default, created_at`,
      [customerId, cleanLabel, cleanAddress, lat, lon, shouldBeDefault]
    );

    return res.status(201).json({
      status: 'success',
      message: 'Address saved successfully.',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 5. Update Saved Address (SRS FR-C9)
 */
export async function updateSavedAddress(req, res, next) {
  try {
    const customerId = req.user.id;
    const addressId = req.params.id;
    const { label, address, is_default } = req.body;

    const existing = await query(
      'SELECT id, customer_id, label, address, latitude, longitude, is_default FROM saved_addresses WHERE id = $1 AND customer_id = $2',
      [addressId, customerId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Saved address not found.' });
    }

    const current = existing.rows[0];
    const newLabel = label?.trim() || current.label;
    const newAddress = address?.trim() || current.address;
    const shouldBeDefault = is_default !== undefined ? Boolean(is_default) : current.is_default;

    let lat = current.latitude;
    let lon = current.longitude;

    if (newAddress !== current.address) {
      const geo = await geocodeAddress(newAddress);
      lat = geo.latitude;
      lon = geo.longitude;
    }

    if (shouldBeDefault) {
      await query(
        'UPDATE saved_addresses SET is_default = false WHERE customer_id = $1 AND id != $2',
        [customerId, addressId]
      );
    }

    const result = await query(
      `UPDATE saved_addresses
       SET label = $1, address = $2, latitude = $3, longitude = $4, is_default = $5
       WHERE id = $6 AND customer_id = $7
       RETURNING id, customer_id, label, address, latitude, longitude, is_default, created_at`,
      [newLabel, newAddress, lat, lon, shouldBeDefault, addressId, customerId]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Address updated successfully.',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 6. Delete Saved Address (SRS FR-C9)
 */
export async function deleteSavedAddress(req, res, next) {
  try {
    const customerId = req.user.id;
    const addressId = req.params.id;

    const result = await query(
      'DELETE FROM saved_addresses WHERE id = $1 AND customer_id = $2 RETURNING id',
      [addressId, customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Saved address not found.' });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Address deleted successfully.',
      data: { id: addressId },
    });
  } catch (err) {
    next(err);
  }
}

export default {
  getCustomerProfile,
  updateCustomerProfile,
  getSavedAddresses,
  addSavedAddress,
  updateSavedAddress,
  deleteSavedAddress,
};
