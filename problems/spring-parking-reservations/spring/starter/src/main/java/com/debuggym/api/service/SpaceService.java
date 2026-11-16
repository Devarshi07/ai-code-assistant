package com.debuggym.api.service;

import com.debuggym.api.dto.CreateSpaceRequest;
import com.debuggym.api.exception.NotFoundException;
import com.debuggym.api.model.Space;
import com.debuggym.api.repository.SpaceRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SpaceService {
    private final SpaceRepository spaces;

    public SpaceService(SpaceRepository spaces) {
        this.spaces = spaces;
    }

    public Space create(CreateSpaceRequest request) {
        return spaces.save(new Space(spaces.nextId(), request.label().trim(), request.level(), request.size()));
    }

    public Space get(long id) {
        return spaces.findById(id).orElseThrow(() -> new NotFoundException("space_not_found", "No space with id " + id));
    }

    public List<Space> list() {
        return spaces.findAll();
    }
}
