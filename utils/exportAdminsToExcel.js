// export-admins-to-excel.js
const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

// Initialize Prisma client
const prisma = new PrismaClient();

async function exportAdminsToExcel() {
    try {
        console.log('📊 Starting admin data export...');

        // Fetch all admin users with selected fields
        const admins = await prisma.admin.findMany({
            select: {
                id: true,
                name: true,
                surname: true,
                email: true,
                number: true,
                department: true,
                company: true,
                lastLogin: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`✅ Fetched ${admins.length} admin records`);

        // Format data for XLSX
        const formattedAdmins = admins.map(admin => ({
            ID: admin.id,
            'Full Name': `${admin.name} ${admin.surname}`.trim(),
            Email: admin.email,
            Phone: admin.number,
            Department: admin.department,
            Company: admin.company,
            'Last Login': admin.lastLogin ? formatDate(admin.lastLogin) : 'Never',
            'Created At': formatDate(admin.createdAt)
        }));

        // Create a new workbook and worksheet
        const worksheet = XLSX.utils.json_to_sheet(formattedAdmins);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Admins');

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `admin_export_${timestamp}.xlsx`;
        const filePath = path.join(__dirname, filename);

        // Write the file
        XLSX.writeFile(workbook, filePath);
        console.log(`✅ Excel file saved to: ${filePath}`);
        
        return filePath;
    } catch (error) {
        console.error('Error exporting admins to Excel:', error);
        throw new Error(`Failed to export admins: ${error.message}`);
    } finally {
        // Close the Prisma client
        await prisma.$disconnect();
    }
}

function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Run the export
exportAdminsToExcel()
    .then(filePath => {
        console.log(`🎉 Export completed: ${filePath}`);
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Export failed:', error);
        process.exit(1);
    })
    .finally(() => {
        prisma.$disconnect().catch(console.error);
    });
