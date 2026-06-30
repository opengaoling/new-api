package authz

import (
	"fmt"
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const AdminRolePermissionsOptionKey = "authz.admin_role_permissions"

// DefaultAdminRolePermissions returns the built-in administrator baseline.
func DefaultAdminRolePermissions() PermissionsMap {
	return roleGrants(RoleSpec{Key: BuiltInRoleAdmin})
}

func NormalizePermissions(permissions PermissionsMap, fallback PermissionsMap) PermissionsMap {
	result := PermissionsMap{}
	for _, resource := range registry {
		actions := map[string]bool{}
		for _, action := range resource.Actions {
			value := fallback[resource.Resource][action.Action]
			if resourcePermissions, ok := permissions[resource.Resource]; ok {
				if override, ok := resourcePermissions[action.Action]; ok {
					value = override
				}
			}
			actions[action.Action] = value
		}
		result[resource.Resource] = actions
	}
	return result
}

func AdminRolePermissionsFromJSONString(raw string) (PermissionsMap, error) {
	fallback := DefaultAdminRolePermissions()
	if raw == "" {
		return NormalizePermissions(nil, fallback), nil
	}
	var parsed PermissionsMap
	if err := common.UnmarshalJsonStr(raw, &parsed); err != nil {
		return nil, err
	}
	return NormalizePermissions(parsed, fallback), nil
}

func AdminRolePermissionsToJSONString(permissions PermissionsMap) (string, error) {
	normalized := NormalizePermissions(permissions, DefaultAdminRolePermissions())
	bytes, err := common.Marshal(normalized)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

func EffectiveAdminRolePermissions() PermissionsMap {
	common.OptionMapRWMutex.RLock()
	raw := common.OptionMap[AdminRolePermissionsOptionKey]
	common.OptionMapRWMutex.RUnlock()
	permissions, err := AdminRolePermissionsFromJSONString(raw)
	if err != nil {
		common.SysError("failed to parse admin role permissions: " + err.Error())
		return DefaultAdminRolePermissions()
	}
	return permissions
}

func ApplyAdminRolePermissionsJSON(raw string) error {
	permissions, err := AdminRolePermissionsFromJSONString(raw)
	if err != nil {
		return err
	}
	return ApplyAdminRolePermissions(permissions)
}

func ApplyAdminRolePermissions(permissions PermissionsMap) error {
	e := currentEnforcer()
	if e == nil {
		return fmt.Errorf("authz enforcer is not initialized")
	}
	if _, err := e.RemoveFilteredPolicy(0, RoleSubject(BuiltInRoleAdmin)); err != nil {
		return err
	}
	for _, policy := range rolePermissionPolicies(permissions) {
		if _, err := e.AddPolicy(RoleSubject(BuiltInRoleAdmin), policy.Resource, policy.Action, policy.Effect); err != nil {
			return err
		}
	}
	return nil
}

func ApplyAdminRolePermissionsInTx(tx *gorm.DB, permissions PermissionsMap) error {
	if err := tx.Where("ptype = ? AND v0 = ?", "p", RoleSubject(BuiltInRoleAdmin)).Delete(&model.CasbinRule{}).Error; err != nil {
		return err
	}
	policies := rolePermissionPolicies(permissions)
	if len(policies) == 0 {
		return nil
	}
	rules := make([]model.CasbinRule, 0, len(policies))
	for _, policy := range policies {
		rules = append(rules, newRule("p", []string{RoleSubject(BuiltInRoleAdmin), policy.Resource, policy.Action, policy.Effect}))
	}
	return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&rules).Error
}

func rolePermissionPolicies(permissions PermissionsMap) []overridePolicy {
	permissions = NormalizePermissions(permissions, DefaultAdminRolePermissions())
	policies := make([]overridePolicy, 0)
	for _, resource := range registry {
		for _, action := range resource.Actions {
			if !permissions[resource.Resource][action.Action] {
				continue
			}
			policies = append(policies, overridePolicy{
				Resource: resource.Resource,
				Action:   action.Action,
				Effect:   EffectAllow,
			})
		}
	}
	sort.Slice(policies, func(i, j int) bool {
		if policies[i].Resource == policies[j].Resource {
			return policies[i].Action < policies[j].Action
		}
		return policies[i].Resource < policies[j].Resource
	})
	return policies
}
