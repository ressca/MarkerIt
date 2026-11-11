package pl.markerit.api.workspaces;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.markerit.api.users.User;
import pl.markerit.api.users.UserRepository;
import pl.markerit.api.workspaces.web.WorkspaceMemberResponse;

@Service
public class WorkspaceMemberService {

    private final WorkspaceMemberRepository members;
    private final UserRepository users;
    private final WorkspaceService workspaces;

    public WorkspaceMemberService(
            WorkspaceMemberRepository members,
            UserRepository users,
            WorkspaceService workspaces) {
        this.members = members;
        this.users = users;
        this.workspaces = workspaces;
    }

    @Transactional(readOnly = true)
    public List<WorkspaceMemberResponse> list(UUID userId, UUID workspaceId) {
        workspaces.requireMember(workspaceId, userId);
        List<WorkspaceMember> membersForWorkspace =
                members.findByWorkspaceIdOrderByCreatedAtAscIdAsc(workspaceId);
        Map<UUID, User> usersById = users
                .findAllById(membersForWorkspace.stream().map(WorkspaceMember::getUserId).toList())
                .stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        return membersForWorkspace.stream()
                .map(member -> toResponse(member, usersById.get(member.getUserId())))
                .toList();
    }

    private WorkspaceMemberResponse toResponse(WorkspaceMember member, User user) {
        String displayName = user == null ? "Usunięty użytkownik" : user.getDisplayName();
        String email = user == null ? "" : user.getEmail();
        return new WorkspaceMemberResponse(
                member.getUserId(),
                displayName,
                email,
                initials(displayName),
                member.getRole());
    }

    private static String initials(String displayName) {
        String[] parts = displayName.trim().split("\\s+");
        if (parts.length == 0 || parts[0].isBlank()) return "U";
        if (parts.length == 1) {
            String part = parts[0];
            return part.length() >= 2
                    ? part.substring(0, 2).toUpperCase(Locale.ROOT)
                    : part.substring(0, 1).toUpperCase(Locale.ROOT);
        }
        return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1))
                .toUpperCase(Locale.ROOT);
    }
}
