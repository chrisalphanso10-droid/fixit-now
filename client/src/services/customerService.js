/**
 * FixIt Now - Customer Service
 * Handles profile fetching/updating and saved addresses CRUD via REST API.
 * Conforms to SRS FR-C8 and FR-C9.
 */

import { get, put, post, del } from './api';
import { getCurrentCustomer } from './authService';

/**
 * Get customer profile (SRS FR-C8)
 */
export async function getCustomerProfile() {
  try {
    const res = await get('/api/customer/profile');
    if (res && res.status === 'success' && res.data) {
      // Keep session updated
      const current = getCurrentCustomer();
      if (current) {
        const merged = { ...current, ...res.data };
        localStorage.setItem('fixit_user', JSON.stringify(merged));
        localStorage.setItem('fixit_customer_user', JSON.stringify(merged));
      }
      return res.data;
    }
  } catch (err) {
    console.warn('[CustomerService] getCustomerProfile backend call failed, fallback to local session:', err.message);
  }

  const current = getCurrentCustomer();
  return (
    current || {
      name: 'Customer',
      phone: '+91 98450 12345',
      address: '100ft Road, Indiranagar, Bengaluru',
      email: 'customer@example.com',
    }
  );
}

/**
 * Update customer profile (SRS FR-C8)
 */
export async function updateCustomerProfile(profileData) {
  if (!profileData.name?.trim()) throw new Error('Full name cannot be empty.');
  if (!profileData.phone?.trim()) throw new Error('Phone number cannot be empty.');
  if (!profileData.address?.trim()) throw new Error('Street address cannot be empty.');

  try {
    const res = await put('/api/customer/profile', {
      name: profileData.name.trim(),
      phone: profileData.phone.trim(),
      address: profileData.address.trim(),
    });

    if (res && res.status === 'success' && res.data) {
      const current = getCurrentCustomer();
      const updated = { ...current, ...res.data };
      localStorage.setItem('fixit_user', JSON.stringify(updated));
      localStorage.setItem('fixit_customer_user', JSON.stringify(updated));
      return res.data;
    }
  } catch (err) {
    console.warn('[CustomerService] updateCustomerProfile backend call failed, fallback to local:', err.message);
  }

  const current = getCurrentCustomer();
  const updated = {
    ...current,
    name: profileData.name.trim(),
    phone: profileData.phone.trim(),
    address: profileData.address.trim(),
  };
  localStorage.setItem('fixit_user', JSON.stringify(updated));
  localStorage.setItem('fixit_customer_user', JSON.stringify(updated));
  return updated;
}

/**
 * Get all saved addresses for current customer (SRS FR-C9)
 */
export async function getSavedAddresses() {
  try {
    const res = await get('/api/customer/addresses');
    if (res && res.status === 'success' && Array.isArray(res.data)) {
      return res.data;
    }
  } catch (err) {
    console.warn('[CustomerService] getSavedAddresses backend call failed, fallback to empty/local:', err.message);
  }

  return [];
}

/**
 * Add a new saved address (SRS FR-C9)
 */
export async function addSavedAddress({ label, address, is_default = false, latitude, longitude }) {
  if (!label?.trim()) throw new Error('Address label (e.g. Home, Office) is required.');
  if (!address?.trim()) throw new Error('Street address is required.');

  const res = await post('/api/customer/addresses', {
    label: label.trim(),
    address: address.trim(),
    is_default: Boolean(is_default),
    latitude,
    longitude,
  });

  if (res && res.status === 'success' && res.data) {
    return res.data;
  }

  throw new Error(res?.message || 'Failed to save address.');
}

/**
 * Update existing saved address (SRS FR-C9)
 */
export async function updateSavedAddress(id, { label, address, is_default }) {
  const res = await put(`/api/customer/addresses/${id}`, {
    label: label?.trim(),
    address: address?.trim(),
    is_default: is_default !== undefined ? Boolean(is_default) : undefined,
  });

  if (res && res.status === 'success' && res.data) {
    return res.data;
  }

  throw new Error(res?.message || 'Failed to update address.');
}

/**
 * Delete a saved address (SRS FR-C9)
 */
export async function deleteSavedAddress(id) {
  const res = await del(`/api/customer/addresses/${id}`);
  if (res && res.status === 'success') {
    return { success: true };
  }
  throw new Error(res?.message || 'Failed to delete address.');
}

export default {
  getCustomerProfile,
  updateCustomerProfile,
  getSavedAddresses,
  addSavedAddress,
  updateSavedAddress,
  deleteSavedAddress,
};
