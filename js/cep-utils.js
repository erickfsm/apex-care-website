/**
 * @fileoverview Utility helpers for CEP formatting and ViaCEP lookups.
 * @module cep-utils
 */

/**
 * Sanitizes a CEP value by removing all non-digit characters.
 * @param {string} value - Raw CEP value.
 * @returns {string} Sanitized numeric CEP string.
 */
export function sanitizeCep(value = "") {
  return String(value).replace(/\D/g, "");
}

/**
 * Applies the standard Brazilian CEP mask (00000-000).
 * @param {string} value - Raw CEP value.
 * @returns {string} Masked CEP string.
 */
export function applyCepMask(value = "") {
  const digits = sanitizeCep(value);
  if (digits.length <= 5) {
    return digits;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

/**
 * Fetches CEP information from ViaCEP API.
 * @param {string} cep - Raw or sanitized CEP value.
 * @returns {Promise<object>} ViaCEP payload.
 * @throws {Error} If the CEP is invalid or the lookup fails.
 */
export async function fetchCepData(cep) {
  const sanitized = sanitizeCep(cep);
  if (sanitized.length !== 8) {
    throw new Error("CEP inválido. Informe 8 dígitos.");
  }

  const response = await fetch(`https://viacep.com.br/ws/${sanitized}/json/`);
  if (!response.ok) {
    throw new Error("Falha ao consultar o ViaCEP.");
  }

  const data = await response.json();
  if (data?.erro) {
    throw new Error("CEP não encontrado.");
  }

  return data;
}
