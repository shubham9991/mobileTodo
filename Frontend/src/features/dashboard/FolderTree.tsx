import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  ScrollView, 
  Dimensions, 
  TextInput,
  TouchableWithoutFeedback,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../themes/ThemeContext';
import { useDashboard, ProjectNode, getDescendantNodeIds, NodeType } from '../../core/DashboardContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FolderTreeProps {
  visible: boolean;
  onClose: () => void;
}

export const FolderTree = ({ visible, onClose }: FolderTreeProps) => {
  const { theme } = useTheme();
  const { 
    nodes, 
    activeNodeId, 
    setActiveNodeId, 
    createProjectNode, 
    deleteProjectNode, 
    taskGroups 
  } = useDashboard();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['company_worksphere', 'company_modular', 'company_nayayein']));
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeType, setNewNodeType] = useState<NodeType>('PROJECT');

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  const getTaskCountForNode = (nodeId: string) => {
    const descendantIds = getDescendantNodeIds(nodes, nodeId);
    let count = 0;
    taskGroups.forEach(group => {
      group.tasks.forEach(task => {
        if (task.nodeId && descendantIds.includes(task.nodeId)) {
          count++;
        }
      });
    });
    return count;
  };

  const handleAddNode = () => {
    if (!newNodeName.trim()) return;
    createProjectNode({
      name: newNodeName.trim(),
      type: newNodeType,
      parentId: selectedParentId,
      color: newNodeType === 'COMPANY' ? '#EC4899' : newNodeType === 'PROJECT' ? '#3B82F6' : '#10B981',
      icon: newNodeType === 'COMPANY' ? 'business' : newNodeType === 'PROJECT' ? 'folder' : 'groups',
    });
    setNewNodeName('');
    setShowAddModal(false);
  };

  const renderNode = (nodeId: string, depth: number = 0) => {
    const node = nodes[nodeId];
    if (!node) return null;

    const hasChildren = node.childIds && node.childIds.length > 0;
    const isExpanded = expandedIds.has(nodeId);
    const isActive = activeNodeId === nodeId;
    const taskCount = getTaskCountForNode(nodeId);

    return (
      <View key={nodeId}>
        {/* Node Row */}
        <View style={[
          styles.nodeRow,
          { 
            paddingLeft: depth * 16 + 8,
            backgroundColor: isActive ? theme.colors.secondary : 'transparent' 
          }
        ]}>
          <TouchableOpacity 
            onPress={() => toggleExpand(nodeId)} 
            style={styles.expandIconContainer}
          >
            {hasChildren ? (
              <MaterialIcons 
                name={isExpanded ? "keyboard-arrow-down" : "keyboard-arrow-right"} 
                size={20} 
                color={theme.colors.textSecondary} 
              />
            ) : (
              <View style={{ width: 20 }} />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.nodeTextContainer}
            onPress={() => {
              setActiveNodeId(nodeId);
              onClose();
            }}
          >
            <MaterialIcons 
              name={(node.icon || (node.type === 'COMPANY' ? 'business' : 'folder')) as any} 
              size={18} 
              color={node.color || theme.colors.text} 
              style={styles.nodeIcon}
            />
            <Text 
              numberOfLines={1}
              style={[
                styles.nodeName, 
                { 
                  color: isActive ? theme.colors.primary : theme.colors.text,
                  fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_400Regular'
                }
              ]}
            >
              {node.name}
            </Text>
          </TouchableOpacity>

          {/* Task count and actions */}
          <View style={styles.nodeRight}>
            {taskCount > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.colors.accentBg }]}>
                <Text style={[styles.badgeText, { color: theme.colors.textSecondary }]}>
                  {taskCount}
                </Text>
              </View>
            )}

            {/* Inline add node action */}
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => {
                setSelectedParentId(nodeId);
                setNewNodeType(node.type === 'COMPANY' ? 'COMPANY' : 'PROJECT');
                setShowAddModal(true);
              }}
            >
              <MaterialIcons name="add" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>

            {/* Node Delete action */}
            {nodeId !== 'company_worksphere' && (
              <TouchableOpacity 
                style={styles.actionBtn}
                onPress={() => deleteProjectNode(nodeId)}
              >
                <MaterialIcons name="delete-outline" size={16} color={theme.colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Nested Children */}
        {hasChildren && isExpanded && (
          <View>
            {node.childIds.map(childId => renderNode(childId, depth + 1))}
          </View>
        )}
      </View>
    );
  };

  // Find top level nodes (ones without parents)
  const topLevelNodeIds = Object.keys(nodes).filter(id => !nodes[id].parentId);

  return (
    <>
      <Modal
        visible={visible}
        animationType="none"
        transparent={true}
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          {/* Backdrop */}
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>

          {/* Drawer content */}
          <SafeAreaView style={[styles.drawerContainer, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.drawerHeader, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.headerLeft}>
                <View style={[styles.logoBox, { backgroundColor: theme.colors.text }]}>
                  <MaterialIcons name="dashboard" size={14} color={theme.colors.background} />
                </View>
                <Text style={[styles.headerTitle, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  Spaces & Projects
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <MaterialIcons name="close" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Show Global All tasks selector */}
              <TouchableOpacity 
                style={[
                  styles.nodeRow, 
                  { 
                    backgroundColor: activeNodeId === null ? theme.colors.secondary : 'transparent',
                    paddingLeft: 12
                  }
                ]}
                onPress={() => {
                  setActiveNodeId(null);
                  onClose();
                }}
              >
                <MaterialIcons name="grid-view" size={18} color={theme.colors.text} style={styles.nodeIcon} />
                <Text style={[
                  styles.nodeName, 
                  { 
                    color: activeNodeId === null ? theme.colors.primary : theme.colors.text,
                    fontFamily: activeNodeId === null ? 'Inter_600SemiBold' : 'Inter_400Regular' 
                  }
                ]}>
                  All Spaces
                </Text>
              </TouchableOpacity>

              <View style={styles.separator} />

              {topLevelNodeIds.map(id => renderNode(id, 0))}

              {/* Add Top-level Space Button */}
              <TouchableOpacity 
                style={[styles.addTopSpaceBtn, { borderColor: theme.colors.border }]}
                onPress={() => {
                  setSelectedParentId(null);
                  setNewNodeType('COMPANY');
                  setShowAddModal(true);
                }}
              >
                <MaterialIcons name="add" size={16} color={theme.colors.primary} />
                <Text style={[styles.addTopSpaceText, { color: theme.colors.primary, fontFamily: 'Inter_500Medium' }]}>
                  Add New Organization
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Add Folder/Node Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.nodeModalOverlay}>
          <View style={[styles.nodeModalContent, { backgroundColor: theme.colors.cardPrimary }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
              Create New Node
            </Text>

            <TextInput
              placeholder="Name..."
              placeholderTextColor={theme.colors.textSecondary}
              style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
              value={newNodeName}
              onChangeText={setNewNodeName}
              autoFocus
            />

            {/* Type selector */}
            <View style={styles.typeSelectorRow}>
              {(['COMPANY', 'PROJECT', 'TEAM'] as NodeType[]).map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeChip,
                    { 
                      backgroundColor: newNodeType === type ? theme.colors.primary : theme.colors.accentBg,
                    }
                  ]}
                  onPress={() => setNewNodeType(type)}
                >
                  <Text style={{ 
                    color: newNodeType === type ? '#fff' : theme.colors.textSecondary,
                    fontSize: 12,
                    fontFamily: 'Inter_500Medium'
                  }}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.btn, styles.cancelBtn]} 
                onPress={() => setShowAddModal(false)}
              >
                <Text style={{ color: theme.colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.btn, styles.submitBtn, { backgroundColor: theme.colors.primary }]} 
                onPress={handleAddNode}
              >
                <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawerContainer: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 320,
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 16,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBox: {
    width: 24,
    height: 24,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingVertical: 12,
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 12,
  },
  expandIconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nodeIcon: {
    marginRight: 10,
  },
  nodeName: {
    fontSize: 14,
    flex: 1,
  },
  nodeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionBtn: {
    padding: 6,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 10,
    marginHorizontal: 16,
  },
  addTopSpaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    gap: 6,
  },
  addTopSpaceText: {
    fontSize: 13,
  },
  nodeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  nodeModalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    marginBottom: 16,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  typeChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
  },
  submitBtn: {
    minWidth: 80,
  },
});
