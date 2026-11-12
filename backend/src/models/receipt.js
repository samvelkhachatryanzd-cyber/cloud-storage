module.exports = (sequelize, DataTypes) => {
  const Receipt = sequelize.define(
    'Receipt',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      claimId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      uploadedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      fileName: { type: DataTypes.STRING(255), allowNull: false },
      contentType: { type: DataTypes.STRING(100), allowNull: false },
      sizeBytes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      objectKey: { type: DataTypes.STRING(255), allowNull: true },
      data: { type: DataTypes.BLOB('long'), allowNull: true },
    },
    {
      tableName: 'receipts',
      underscored: true,
      updatedAt: false,
      defaultScope: { attributes: { exclude: ['data', 'objectKey'] } },
    }
  );

  Receipt.associate = (models) => {
    Receipt.belongsTo(models.Claim, { foreignKey: 'claimId', as: 'claim' });
    Receipt.belongsTo(models.User, { foreignKey: 'uploadedBy', as: 'uploader' });
  };

  return Receipt;
};
