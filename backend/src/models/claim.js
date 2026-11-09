module.exports = (sequelize, DataTypes) => {
  const Claim = sequelize.define(
    'Claim',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      title: { type: DataTypes.STRING(200), allowNull: false },
      amountCents: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      spentOn: { type: DataTypes.DATEONLY, allowNull: false },
    },
    { tableName: 'claims', underscored: true, updatedAt: false }
  );

  Claim.associate = (models) => {
    Claim.belongsTo(models.User, { foreignKey: 'userId', as: 'employee' });
    Claim.hasMany(models.Receipt, { foreignKey: 'claimId', as: 'receipts' });
  };

  return Claim;
};
