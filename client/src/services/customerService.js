/**
 * FixIt Now - Customer Service
 * Handles profile fetching/updating and saved addresses CRUD.
 * Conforms to SRS FR-C8 and FR-C9.
 */

import { mockCustomers, mockSavedAddresses } from '../mockData';
import { getCurrentCustomer } from './authService';

const ADDRESSES_KEY = 'fixit_customer_saved_addresses';
const PROFILE_KEY = 'fixit_customer_profile';

function getStoredAddresses() {
  try {
    const raw = localStorage.getItem(ADDRESSES_KEY);
    return raw ? JSON.parse(raw) : mockSavedAddresses;
  } catch {
    return mockSavedAddresses;
  }
}

function saveStoredAddresses(list) {
  try {
    localStorage.setItem(ADDRESSES_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

/**
 * Get customer profile
 */
export async function getCustomerProfile() {
  await new Promise((resolve) => setTimeout(resolve, 150));
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  const current = getCurrentCustomer();
  return current || mockCustomers[0];
}

/**
 * Update customer profile (SRS FR-C8)
 */
export async function updateCustomerProfile(profileData) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (!profileData.name?.trim()) throw new Error('Name cannot be empty.');
  if (!profileData.phone?.trim()) throw new Error('Phone cannot be empty.');
  if (!profileData.address?.trim()) throw new Error('Address cannot be empty.');

  const current = await getCustomerProfile();
  const updated = {
    ...current,
    name: profileData.name.trim(),
    phone: profileData.phone.trim(),
    address: profileData.address.trim(),
    coordinates: profileData.coordinates || current.coordinates,
  };

  localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
  return updated;
}

/**
 * Get all saved addresses for current customer (SRS FR-C9)
 */
export async function getSavedAddresses() {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return getStoredAddresses();
}

/**
 * Add a new saved address
 */
export async function addSavedAddress({ label, address, is_default = false }) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (!label?.trim()) throw new Error('Address label (e.g. Home, Office) is required.');
  if (!address?.trim()) throw new Error('Street address is required.');

  const addresses = getStoredAddresses();
  if (is_default) {
    addresses.forEach((a) => {
      a.is_default = false;
    });
  }

  const newAddress = {
    id: Date.now(),
    customer_id: 1,
    label: label.trim(),
    address: address.trim(),
    coordinates: { lat: 12.9784 + (Math.random() - 0.5) * 0.01, lng: 77.6408 + (Math.random() - 0.5) * 0.01 },
    is_default: Boolean(is_default) || addresses.length === 0,
  };

  addresses.push(newAddress);
  saveStoredAddresses(addresses);
  return newAddress;
}

/**
 * Update existing saved address
 */
export async function updateSavedAddress(id, { label, address, is_default }) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const addresses = getStoredAddresses();
  const index = addresses.findIndex((a) => a.id === id);
  if (index === -1) throw new Error('Address not found.');

  if (is_default) {
    addresses.forEach((a) => {
      a.is_default = false;
    });
  }

  addresses[index] = {
    ...addresses[index],
    label: label?.trim() || addresses[index].label,
    address: address?.trim() || addresses[index].address,
    is_default: is_default !== undefined ? Boolean(is_default) : addresses[index].is_default,
  };

  saveStoredAddresses(addresses);
  return addresses[index];
}

/**
 * Delete a saved address
 */
export async function deleteSavedAddress(id) {
  await new Promise((resolve) => setTimeout(resolve, 150));
  const addresses = getStoredAddresses().filter((a) => a.id !== id);
  saveStoredAddresses(addresses);
  return { success: true };
}
