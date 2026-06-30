package authz

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdminRolePermissionsDefaultDisablesChannelStatus(t *testing.T) {
	permissions := DefaultAdminRolePermissions()

	assert.True(t, permissions[ResourceChannel][ActionRead])
	assert.True(t, permissions[ResourceChannel][ActionOperate])
	assert.False(t, permissions[ResourceChannel][ActionStatus])
	assert.True(t, permissions[ResourceChannel][ActionWrite])
	assert.False(t, permissions[ResourceChannel][ActionSensitiveWrite])
	assert.False(t, permissions[ResourceChannel][ActionSecretView])
}

func TestApplyAdminRolePermissionsCanGrantChannelStatus(t *testing.T) {
	db := newAuthzTestDB(t)
	require.NoError(t, Init(db))
	assert.False(t, Can(2, common.RoleAdminUser, ChannelStatus))

	permissions := DefaultAdminRolePermissions()
	permissions[ResourceChannel][ActionStatus] = true
	require.NoError(t, ApplyAdminRolePermissions(permissions))

	assert.True(t, Can(2, common.RoleAdminUser, ChannelStatus))
}

func TestAdminRolePermissionsFromJSONStringNormalizesUnknownFields(t *testing.T) {
	permissions, err := AdminRolePermissionsFromJSONString(`{"channel":{"status":true,"unknown":true},"unknown":{"read":true}}`)
	require.NoError(t, err)

	assert.True(t, permissions[ResourceChannel][ActionStatus])
	_, hasUnknownAction := permissions[ResourceChannel]["unknown"]
	assert.False(t, hasUnknownAction)
	_, hasUnknownResource := permissions["unknown"]
	assert.False(t, hasUnknownResource)
}
