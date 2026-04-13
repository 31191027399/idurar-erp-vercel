export const fields = {
  name: {
    type: 'string',
    required: true,
  },
  surname: {
    type: 'string',
    required: true,
  },
  email: {
    type: 'email',
    required: true,
  },
  password: {
    type: 'string',
    required: true,
    hideForUpdate: true,
  },
  role: {
    type: 'select',
    required: true,
    options: [
      { value: 'admin', label: 'super_admin' },
      { value: 'manager', label: 'manager' },
      { value: 'employee', label: 'employee' },
      { value: 'create_only', label: 'create_only' },
      { value: 'read_only', label: 'read_only' },
    ],
  },
  enabled: {
    type: 'boolean',
    default: true,
  },
};