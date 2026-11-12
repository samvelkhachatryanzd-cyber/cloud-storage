'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('receipts', 'data', {
      type: Sequelize.BLOB('long'),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Fails if any row already has data = NULL, i.e. its file only exists in object storage.
    await queryInterface.changeColumn('receipts', 'data', {
      type: Sequelize.BLOB('long'),
      allowNull: false,
    });
  },
};
