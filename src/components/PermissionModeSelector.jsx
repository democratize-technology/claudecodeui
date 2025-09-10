import React from 'react';

function PermissionModeSelector({ mode, onModeChange, className = '' }) {
  // Mode configuration with styling and labels
  const modeConfig = {
    default: {
      label: 'Default Mode',
      bgColor: 'bg-gray-100 dark:bg-gray-700',
      textColor: 'text-gray-700 dark:text-gray-300',
      borderColor: 'border-gray-300 dark:border-gray-600',
      hoverColor: 'hover:bg-gray-200 dark:hover:bg-gray-600',
      dotColor: 'bg-gray-500'
    },
    acceptEdits: {
      label: 'Accept Edits',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-700 dark:text-green-300',
      borderColor: 'border-green-300 dark:border-green-600',
      hoverColor: 'hover:bg-green-100 dark:hover:bg-green-900/30',
      dotColor: 'bg-green-500'
    },
    bypassPermissions: {
      label: 'Bypass Permissions',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      textColor: 'text-orange-700 dark:text-orange-300',
      borderColor: 'border-orange-300 dark:border-orange-600',
      hoverColor: 'hover:bg-orange-100 dark:hover:bg-orange-900/30',
      dotColor: 'bg-orange-500'
    },
    plan: {
      label: 'Plan Mode',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-700 dark:text-blue-300',
      borderColor: 'border-blue-300 dark:border-blue-600',
      hoverColor: 'hover:bg-blue-100 dark:hover:bg-blue-900/30',
      dotColor: 'bg-blue-500'
    }
  };

  const currentConfig = modeConfig[mode] || modeConfig.default;

  return (
    <button
      type='button'
      onClick={onModeChange}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${currentConfig.bgColor} ${currentConfig.textColor} ${currentConfig.borderColor} ${currentConfig.hoverColor} ${className}`}
      title='Click to change permission mode (or press Tab in input)'
    >
      <div className='flex items-center gap-2'>
        <div className={`w-2 h-2 rounded-full ${currentConfig.dotColor}`} />
        <span>{currentConfig.label}</span>
      </div>
    </button>
  );
}

export default PermissionModeSelector;