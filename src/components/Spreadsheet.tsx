import React, { useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import { useAppContext } from '../context/AppContext';

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);

export const Spreadsheet: React.FC = () => {
  const { data, updateTransactions, isLoading } = useAppContext();

  const rowData = useMemo(() => data?.transactions || [], [data?.transactions]);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      { field: 'date', headerName: 'Date', sortable: true, filter: true, width: 120 },
      { field: 'description', headerName: 'Description', sortable: true, filter: true, flex: 1, editable: true },
      { 
        field: 'amount', 
        headerName: 'Amount', 
        sortable: true, 
        filter: 'agNumberColumnFilter',
        valueFormatter: (params) => {
          if (params.value == null) return '';
          return `$${params.value.toFixed(2)}`;
        },
        width: 120
      },
      { field: 'type', headerName: 'Type', sortable: true, filter: true, width: 100 },
      { field: 'category', headerName: 'Category', sortable: true, filter: true, editable: true, width: 150 },
      { 
        field: 'tags', 
        headerName: 'Tags', 
        sortable: true, 
        filter: true, 
        editable: true,
        valueGetter: (params) => params.data?.tags?.join(', ') || '',
        valueSetter: (params) => {
          const newTags = params.newValue ? params.newValue.split(',').map((t: string) => t.trim()) : [];
          params.data.tags = newTags;
          return true;
        },
        flex: 1 
      },
      { field: 'comments', headerName: 'Comments', editable: true, flex: 1 }
    ],
    []
  );

  const onCellValueChanged = useCallback(
    (event: any) => {
      // Whenever a cell changes, we save the whole list to Google Drive
      const updatedTransactions = [...(data?.transactions || [])];
      updateTransactions(updatedTransactions);
    },
    [data, updateTransactions]
  );

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
        <h2 className="text-lg font-semibold text-gray-800">Transactions</h2>
        {isLoading && <span className="text-sm text-gray-500">Syncing...</span>}
      </div>
      <div className="flex-1 w-full relative">
        <div style={{ height: '600px', width: '100%' }}>
          <AgGridReact
            rowData={rowData}
            columnDefs={columnDefs}
            onCellValueChanged={onCellValueChanged}
            theme="legacy"
            pagination={true}
            paginationPageSize={50}
            paginationPageSizeSelector={[50, 100, 500]}
          />
        </div>
      </div>
    </div>
  );
};
