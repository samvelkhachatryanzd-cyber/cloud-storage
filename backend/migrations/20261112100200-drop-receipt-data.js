'use strict';

// Removes receipts.data once every file lives in object storage.
//
// Run order: npm run storage:backfill, storage:verify, storage:clear --confirm, then deploy code that no
// longer reads receipts.data (the Receipt model and getReceiptFile), and only then this migration.
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('receipts', 'data');
  },

  async down(queryInterface, Sequelize) {
    // The column comes back empty: the file contents are not restored. They are in the bucket.
    await queryInterface.addColumn('receipts', 'data', {
      type: Sequelize.BLOB('long'),
      allowNull: true,
    });
  },
};
