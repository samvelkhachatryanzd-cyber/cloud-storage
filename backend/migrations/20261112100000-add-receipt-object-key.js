'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('receipts', 'object_key', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'size_bytes',
    });
    await queryInterface.addIndex('receipts', ['object_key'], {
      name: 'receipts_object_key_unique',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('receipts', 'receipts_object_key_unique');
    await queryInterface.removeColumn('receipts', 'object_key');
  },
};
