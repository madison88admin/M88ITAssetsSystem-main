We need to restructure the user roles of the M88 ITEIMS:

- Executive (CEO, CFO, Any person that is of very high position in the company) - This can access Dashboard, Reports, Audit Logs, and Settings.
   - The Dashboard has a dropdown function to see all Madison88 IT Assets, Madison88 IT Assets in the Philippines, Madison88 IT Assets in Indonesia, Madison88 IT Assets in China, and Madison88 IT Assets in United States.
   - This user can generate Reports either PDF or Excel. They can export overall Asset Master List of every location they want to, overall Assignment Report of every location they want to, overall Warranty Report of every location they want to, overall Maintenance History of every location they want to, overall Employee Directory of every location they want to, and overall Lost Assets Report of every location they want to
   - All the Audit Logs of every user type are logged for this user. To view and ensure that everything is aligned and secured.
   - They have all the System Setting that includes Users, Permissions, Assignment Rules, and Categories.
       - Users: They can modify all users and their roles and indicate what location they must be assigned.
       - Permissions: They can modify user permissions of every role that is depending on what is important (you can include necessary permissions needed for this).
       - Assignment Rules: They can configure whether each asset category allows single or multiple assignments to employees (Same as we have right now for the Admin).
       - Categories: They can add, deactivate, or edit categories (Same as we have right now for the Admin).

- Admin (Assigned Manager to every region depending on the location) - This is the current admin that we have in the system and they can access Dashboard, Assets, Employees, Assignments, Maintenance, Lost Assets, Software Licenses, Reports, Audit Logs, and Settings.
   - The Dashboard only shows the Dashboard of their current region. Might be Madison88 IT Assets in the Philippines, Madison88 IT Assets in Indonesia, Madison88 IT Assets in China, and Madison88 IT Assets in United States depending on where admin they are assigned.
   - The Assets tab is still the same with the current system, but they can only add, edit, and import assets that is within their specified region.
   - The Employees tab is still the same with the current system, but they can only add, edit, and import employees that is within their specified region
   - The Assignments tab is still the same with the current system, but they can only add, edit, filter, and assign assets to an employee that is within their specified region
   - The Maintenance tab is still the same with the current system, but they can only log, filter, and edit assets that are within their specific region.
   - The Lost Assets tab is still the same with the current system, but they can only report lost asset, filter, and edit assets that are within their specific region.
   - Software Licenses tab is still the same with the current system, but they can only add, filter, and edit licenses that are within their specific region (If the admin who added that software license, it will automatically be tracked by that admin of that specific region only. For example, if that software was added by Admin that is specified in the Philippines, automatically the software license can only be managed by admins and it staff that is within the Philippines, the logic applies to other regions as well).
   - This user can generate Reports either PDF or Excel. They can export Asset Master List of their specific region only, Assignment Report of their specific region only, Warranty Report of their specific region only, Maintenance History of their specific region only, Employee Directory of their specific region only, and Lost Assets Report their specific region only.
   - All the Audit Logs of every user type even other Admins from other regions aside from Executive role are logged for this user. To view and ensure that everything is aligned and secured.
   - They have all the System Setting that includes Users and Permissions.
       - Users: They can modify user roles below them which are IT Staff and Viewer. These roles can be edited and can be modified if still active or no. (Only for their assigned region)
       - Permissions: They can modify user permissions of IT Staff role (Same as what we have right now).

- IT Staff (IT staff, IT employee, or IT personnel that is tasked to manage this system for the specific region) - This is the current IT Staff that we have in the system, and they can access Dashboard, Assets, Employees, Assignments, Maintenance, Lost Assets, and Software Licenses. (Reports and Audit Logs still depends on if the Admin allows).
   - The Dashboard only shows the Dashboard of their current region. Might be Madison88 IT Assets in the Philippines, Madison88 IT Assets in Indonesia, Madison88 IT Assets in China, and Madison88 IT Assets in United States depending on where admin they are assigned.
   - The Assets tab is still the same with the current system, but they can only add, edit, and import (depending on if their region administrator allows) assets that is within their specified region.
   - The Employees tab is still the same with the current system, but they can only add, edit, and import (depending on if their region administrator allows) employees that is within their specified region
   - The Assignments tab is still the same with the current system, but they can only add, edit, filter, and assign assets to an employee that is within their specified region
   - The Maintenance tab is still the same with the current system, but they can only log, filter, and edit assets that are within their specific region.
   - The Lost Assets tab is still the same with the current system, but they can only report lost asset, filter, and edit assets that are within their specific region.
   - Software Licenses tab is still the same with the current system, but they can only add, filter, and edit licenses that are within their specific region (If the IT Staff who added that software license, it will automatically be tracked by that admin of that specific region only. For example, if that software was added by IT Staff that is specified in the Philippines, automatically the software license can only be managed by admins and it staff that is within the Philippines, the logic applies to other regions as well).
   - This user can generate Reports either PDF or Excel if they are allowed by their admin. They can export Asset Master List of their specific region only, Assignment Report of their specific region only, Warranty Report of their specific region only, Maintenance History of their specific region only, Employee Directory of their specific region only, and Lost Assets Report their specific region only.
   - The audit log of IT Staff is the same the current system now.

- Viewer (All employees or stakeholders that are concerned) - This is the current Viewer that we have in the system, and they can only see the dashboard 