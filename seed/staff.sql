-- Demo department staff for Ranchi. Login with the 10-digit numbers (OTP normalizes to +91).
-- 9100000001 Roads Admin · 9100000002 Roads Field
-- 9100000003 Sanitation Admin · 9100000004 Sanitation Field
-- 9100000005 Lighting Admin · 9100000006 Lighting Field
-- 9100000007 Drainage Admin · 9100000008 Drainage Field

INSERT INTO users (phone, name) VALUES
  ('+919100000001', 'Roads Admin'),
  ('+919100000002', 'Roads Field Staff'),
  ('+919100000003', 'Sanitation Admin'),
  ('+919100000004', 'Sanitation Field Staff'),
  ('+919100000005', 'Lighting Admin'),
  ('+919100000006', 'Lighting Field Staff'),
  ('+919100000007', 'Drainage Admin'),
  ('+919100000008', 'Drainage Field Staff')
ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO department_memberships (user_id, municipality_id, department_id, role)
SELECT u.id, d.municipality_id, d.id, v.role::staff_role
FROM (VALUES
  ('+919100000001', 'Roads & Infrastructure', 'DEPT_ADMIN'),
  ('+919100000002', 'Roads & Infrastructure', 'FIELD_STAFF'),
  ('+919100000003', 'Sanitation & Solid Waste', 'DEPT_ADMIN'),
  ('+919100000004', 'Sanitation & Solid Waste', 'FIELD_STAFF'),
  ('+919100000005', 'Street Lighting', 'DEPT_ADMIN'),
  ('+919100000006', 'Street Lighting', 'FIELD_STAFF'),
  ('+919100000007', 'Drainage & Water', 'DEPT_ADMIN'),
  ('+919100000008', 'Drainage & Water', 'FIELD_STAFF')
) AS v(phone, dept_name, role)
JOIN users u ON u.phone = v.phone
JOIN departments d ON d.name = v.dept_name
JOIN municipalities m ON m.id = d.municipality_id AND m.name = 'Ranchi Municipal Corporation'
ON CONFLICT (user_id) DO UPDATE
  SET municipality_id = EXCLUDED.municipality_id,
      department_id = EXCLUDED.department_id,
      role = EXCLUDED.role;
