module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING(100), allowNull: false },
      role: { type: DataTypes.ENUM('employee', 'finance'), allowNull: false, defaultValue: 'employee' },
    },
    {
      tableName: 'users',
      underscored: true,
      updatedAt: false,
      defaultScope: { attributes: { exclude: ['passwordHash'] } },
    }
  );

  User.associate = (models) => {
    User.hasMany(models.Claim, { foreignKey: 'userId', as: 'claims' });
  };

  return User;
};
