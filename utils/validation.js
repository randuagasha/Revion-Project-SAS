import validator from "validator";

// EMAIL VALIDATION
export const isValidEmail = (email) => {
  return validator.isEmail(email || "");
};

// EMPTY VALIDATION
export const isNotEmpty = (value) => {
  return (
    value !== undefined && value !== null && value.toString().trim() !== ""
  );
};

// YEAR VALIDATION
export const isValidYear = (year) => {
  const currentYear = new Date().getFullYear();

  return Number(year) >= 1950 && Number(year) <= currentYear + 1;
};

// ENUM VALIDATION
export const isInEnum = (value, enums = []) => {
  return enums.includes(value);
};
