// Core validations
export const validateEmail = (email) => {
  if (!email) return { isValid: false, message: 'Email is required' };
  if (typeof email !== 'string') return { isValid: false, message: 'Email must be a string' };
  
  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, message: 'Invalid email format' };
  }

  return { isValid: true };
};

export const validatePassword = (password) => {
  if (!password) return { isValid: false, message: 'Password is required' };
  if (typeof password !== 'string') return { isValid: false, message: 'Password must be a string' };
  if (password.length < 8) return { isValid: false, message: 'Password must be at least 8 characters long' };

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    };
  }

  return { isValid: true };
};

export const validateUsername = (username) => {
  if (!username) return { isValid: false, message: 'Username is required' };
  if (typeof username !== 'string') return { isValid: false, message: 'Username must be a string' };
  if (username.length < 5) return { isValid: false, message: 'Username must be at least 5 characters long' };
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { isValid: false, message: 'Username can only contain letters, numbers, underscores, and hyphens' };
  }
  return { isValid: true };
};

export const validateRole = (role) => {
  const validRoles = ['clinic', 'collector', 'health'];
  if (!role) return { isValid: false, message: 'Role is required' };
  if (!validRoles.includes(role)) {
    return { isValid: false, message: `Role must be one of: ${validRoles.join(', ')}` };
  }
  return { isValid: true };
};

export const validateCoordinates = (coordinates) => {
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
    return { isValid: false, message: 'Coordinates must be an array of [longitude, latitude]' };
  }

  const [longitude, latitude] = coordinates;
  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    return { isValid: false, message: 'Coordinates must be numbers' };
  }

  if (longitude < -180 || longitude > 180) {
    return { isValid: false, message: 'Longitude must be between -180 and 180' };
  }

  if (latitude < -90 || latitude > 90) {
    return { isValid: false, message: 'Latitude must be between -90 and 90' };
  }

  return { isValid: true };
};

export const validatePhone = (phone) => {
  if (!phone) return { isValid: false, message: 'Phone number is required' };
  if (typeof phone !== 'string') return { isValid: false, message: 'Phone number must be a string' };

  const phoneRegex = /^\+?[\d\s-]{10,}$/;
  if (!phoneRegex.test(phone)) {
    return { 
      isValid: false, 
      message: 'Invalid phone number format. Must be at least 10 digits with optional + prefix' 
    };
  }

  return { isValid: true };
};

export const validateAddress = (address) => {
  if (!address || typeof address !== 'object') {
    return { isValid: false, message: 'Address is required and must be an object' };
  }

  const { street, city, state, zipCode, location } = address;

  // Validate required fields
  if (!street || !city || !state || !zipCode) {
    return { isValid: false, message: 'All address fields are required' };
  }

  // Validate string fields
  const stringFields = [
    { field: 'street', value: street },
    { field: 'city', value: city },
    { field: 'state', value: state },
    { field: 'zipCode', value: zipCode }
  ];

  for (const { field, value } of stringFields) {
    if (typeof value !== 'string' || !value.trim()) {
      return { isValid: false, message: `${field} must be a non-empty string` };
    }
  }

  // Validate location if provided
  if (location) {
    const locationCheck = validateLocation(location);
    if (!locationCheck.isValid) return locationCheck;
  }

  return { isValid: true };
};

export const validateLocation = (location) => {
  if (!location || typeof location !== 'object') {
    return { isValid: false, message: 'Location must be an object' };
  }

  if (location.type !== 'Point') {
    return { isValid: false, message: 'Location type must be Point' };
  }

  return validateCoordinates(location.coordinates);
};

export const validateServiceArea = (serviceArea, isCollector = false) => {
  if (!isCollector) return { isValid: true }; // Only required for collectors

  if (!serviceArea || typeof serviceArea !== 'object') {
    return { isValid: false, message: 'Service area is required for collectors' };
  }

  if (serviceArea.type !== 'Polygon') {
    return { isValid: false, message: 'Service area type must be Polygon' };
  }

  if (!Array.isArray(serviceArea.coordinates) || !serviceArea.coordinates.length) {
    return { isValid: false, message: 'Service area coordinates are required' };
  }

  // Validate each ring of coordinates
  for (const ring of serviceArea.coordinates) {
    if (!Array.isArray(ring) || ring.length < 4) {
      return { 
        isValid: false, 
        message: 'Each service area ring must be an array of at least 4 coordinate pairs' 
      };
    }

    // First and last points should be the same
    if (JSON.stringify(ring[0]) !== JSON.stringify(ring[ring.length - 1])) {
      return { 
        isValid: false, 
        message: 'First and last points of each ring must be the same' 
      };
    }

    // Validate each coordinate pair
    for (const point of ring) {
      const coordCheck = validateCoordinates(point);
      if (!coordCheck.isValid) return coordCheck;
    }
  }

  return { isValid: true };
};

export const validateUserRegistration = (data) => {
  const { 
    username, 
    email, 
    password, 
    role, 
    phone, 
    address, 
    serviceArea, 
    profileImage 
  } = data;

  // Required field checks
  const requiredChecks = [
    validateUsername(username),
    validateEmail(email),
    validatePassword(password),
    validateRole(role),
    validatePhone(phone),
    validateAddress(address)
  ];

  for (const check of requiredChecks) {
    if (!check.isValid) return check;
  }

  // Service area check for collectors
  if (role === 'collector') {
    const serviceAreaCheck = validateServiceArea(serviceArea, true);
    if (!serviceAreaCheck.isValid) return serviceAreaCheck;
  }

  return {
    isValid: true,
    data: {
      username,
      email,
      password,
      role,
      phone,
      address,
      serviceArea,
      profileImage: profileImage || 'default.jpg'
    }
  };
};

export const validateUserUpdate = (data) => {
  const updates = {};
  const { username, email, role, phone, address, serviceArea, profileImage } = data;

  if (username) {
    const check = validateUsername(username);
    if (!check.isValid) return check;
    updates.username = username;
  }

  if (email) {
    const check = validateEmail(email);
    if (!check.isValid) return check;
    updates.email = email;
  }

  if (role) {
    const check = validateRole(role);
    if (!check.isValid) return check;
    updates.role = role;
  }

  if (phone) {
    const check = validatePhone(phone);
    if (!check.isValid) return check;
    updates.phone = phone;
  }

  if (address) {
    const check = validateAddress(address);
    if (!check.isValid) return check;
    updates.address = address;
  }

  if (serviceArea) {
    const check = validateServiceArea(serviceArea, data.role === 'collector');
    if (!check.isValid) return check;
    updates.serviceArea = serviceArea;
  }

  if (profileImage) {
    updates.profileImage = profileImage;
  }

  return {
    isValid: true,
    data: updates
  };
};

export const validateUserLogin = ({ email, password }) => {
  if (!email || !password) {
    return { isValid: false, message: 'All fields are required' };
  }

  const emailCheck = validateEmail(email);
  if (!emailCheck.isValid) return emailCheck;

  return { isValid: true, data: { email, password } };
};

export const validateUserDelete = ({ id }) => {
  if (!id) {
    return { isValid: false, message: 'User ID is required' };
  }
  return { isValid: true, data: { id } };
};

export const validateUserGet = ({ id }) => {
  if (!id) {
    return { isValid: false, message: 'User ID is required' };
  }
  return { isValid: true, data: { id } };
};

export const validateUserGetAll = () => {
  return { isValid: true, data: {} };
};

export const validateUserGetByRole = ({ role }) => {
  const roleCheck = validateRole(role);
  if (!roleCheck.isValid) return roleCheck;
  return { isValid: true, data: { role } };
};

export const validateUserGetByStatus = ({ status }) => {
  if (!status) {
    return { isValid: false, message: 'User status is required' };
  }
  return { isValid: true, data: { status } };
};

export const validateUserUpdateStatus = ({ id, status }) => {
  if (!id || !status) {
    return { isValid: false, message: 'ID and status are required' };
  }
  return { isValid: true, data: { id, status } };
};
